const pool = require("../config/db");
const { evaluateMessage } = require("../conversation/safetyEngine");
const initSocketServer = require("../realtime/socketServer");
const { applyTrustAfterCheckin, getTrustDisplayForUser } = require("../services/trustService");

function emitNewChatMessage(matchId, row) {
    if (!row) return;
    const io = typeof initSocketServer.getIO === "function" ? initSocketServer.getIO() : null;
    if (!io) return;
    const mid = parseInt(String(matchId), 10);
    if (Number.isNaN(mid)) return;
    io.to(`match_${mid}`).emit("new_message", row);
}

function surveyTriggerAtSql() {
    const forceStrict = process.env.POST_DATE_SURVEY_RELAXED_TIMING === "false"
        || process.env.POST_DATE_SURVEY_RELAXED_TIMING === "0";
    const forceRelaxed = process.env.POST_DATE_SURVEY_RELAXED_TIMING === "true"
        || process.env.POST_DATE_SURVEY_RELAXED_TIMING === "1";
    if (forceStrict) return "proposed_datetime + interval '2 hours' + interval '1 minute'";
    if (forceRelaxed) return "NOW()";
    if (process.env.NODE_ENV === "production") return "proposed_datetime + interval '2 hours' + interval '1 minute'";
    return "NOW()";
}


const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

function getDayOfWeek(isoString) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: APP_TIMEZONE,
    })
        .format(d)
        .toLowerCase();
}

function getTimeString(isoString) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: APP_TIMEZONE,
    }).formatToParts(d);
    const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
    const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hh}:${mm}:00`;
}

async function checkAvailability(userId, dayOfWeek, timeStr) {
    const result = await pool.query(
        `SELECT availability_id FROM user_availability
         WHERE user_id     = $1
           AND day_of_week = $2
           AND start_time  <= $3::time
           AND end_time     >  $3::time`,
        [userId, dayOfWeek, timeStr]
    );
    return result.rows.length > 0;
}

exports.getMatchAvailability = async (req, res) => {
    const jwtUserId = parseInt(req.user.id, 10);
    const matchId   = parseInt(req.params.matchId, 10);

    if (Number.isNaN(matchId)) {
        return res.status(400).json({ error: "Invalid match id." });
    }

    try {
        const matchResult = await pool.query(
            `SELECT user1_id, user2_id FROM matches WHERE match_id = $1 AND match_status = 'active'`,
            [matchId]
        );
        if (!matchResult.rows.length) {
            return res.status(404).json({ error: "Match not found." });
        }

        const { user1_id, user2_id } = matchResult.rows[0];
        if (jwtUserId !== user1_id && jwtUserId !== user2_id) {
            return res.status(403).json({ error: "Forbidden." });
        }

        const otherUserId = jwtUserId === user1_id ? user2_id : user1_id;

        const [selfRows, otherRows] = await Promise.all([
            pool.query(
                `SELECT day_of_week,
                        to_char(start_time, 'HH24:MI') AS start_time,
                        to_char(end_time,   'HH24:MI') AS end_time
                 FROM user_availability WHERE user_id = $1`,
                [jwtUserId]
            ),
            pool.query(
                `SELECT day_of_week,
                        to_char(start_time, 'HH24:MI') AS start_time,
                        to_char(end_time,   'HH24:MI') AS end_time
                 FROM user_availability WHERE user_id = $1`,
                [otherUserId]
            ),
        ]);

        res.json({
            self_unavailable:  selfRows.rows,
            other_unavailable: otherRows.rows,
        });
    } catch (err) {
        console.error("getMatchAvailability error:", err.message);
        res.status(500).json({ error: "Failed to fetch availability." });
    }
};

exports.sendDateRequest = async (req, res) => {
    const { match_id, sender_id, venue_type, venue_name, proposed_datetime } = req.body;

    if (!match_id || !sender_id || !venue_type || !proposed_datetime) {
        return res.status(400).json({ error: "match_id, sender_id, venue_type, and proposed_datetime are required." });
    }

    const jwtUserId = parseInt(req.user.id, 10);
    if (parseInt(sender_id, 10) !== jwtUserId) {
        return res.status(403).json({ error: "sender_id must match the signed-in user." });
    }

    try {
        const senderRow = await pool.query(
            `SELECT trust_public_dates_only, tier_id, COALESCE(premium_suspended, false) AS premium_suspended
             FROM users WHERE user_id = $1`,
            [jwtUserId]
        );
        if (senderRow.rows[0]?.trust_public_dates_only && venue_type !== "public") {
            return res.status(403).json({
                error: "Your account may only schedule public venue dates until trust improves.",
            });
        }

        const weeklyCount = await pool.query(
            `SELECT COUNT(*) AS count FROM notifications
             WHERE type = 'date_request'
               AND (payload->>'sender_id')::int = $1
               AND created_at >= date_trunc('week', NOW())`,
            [parseInt(sender_id)]
        );

        const sentThisWeek = parseInt(weeklyCount.rows[0].count);
        if (sentThisWeek >= 3) {
            let tierId = senderRow.rows[0]?.tier_id || 1;
            if (senderRow.rows[0]?.premium_suspended) tierId = 1;
            const payload = {
                error:         "You have reached your weekly date request limit of 3. Resets every Monday.",
                requests_used: sentThisWeek,
                resets_on:     "Monday",
            };
            if (tierId === 1) payload.upgrade_hint = "aura_plus";
            return res.status(429).json(payload);
        }

        const matchResult = await pool.query(
            `SELECT user1_id, user2_id FROM matches WHERE match_id = $1 AND match_status = 'active'`,
            [match_id]
        );
        if (!matchResult.rows.length) {
            return res.status(404).json({ error: "Match not found or inactive." });
        }

        const { user1_id, user2_id } = matchResult.rows[0];
        const recipient_id = parseInt(sender_id) === user1_id ? user2_id : user1_id;

        const previousDates = await pool.query(
            `SELECT COUNT(*) AS count FROM date_scheduling WHERE match_id = $1 AND status = 'approved'`,
            [match_id]
        );
        const hasMetBefore = parseInt(previousDates.rows[0].count) > 0;

        if (!hasMetBefore && venue_type !== "public") {
            return res.status(403).json({
                error:      "First dates must be at a public venue for safety. Please choose a restaurant, coffee shop, or park.",
                rule:       "first_meeting_public",
                suggestion: "Select a public venue from the map.",
            });
        }

        const dayOfWeek = getDayOfWeek(proposed_datetime);
        const timeStr   = getTimeString(proposed_datetime);
        if (!dayOfWeek || !timeStr) {
            return res.status(400).json({ error: "Invalid proposed_datetime." });
        }

        const senderUnavailable = await checkAvailability(jwtUserId, dayOfWeek, timeStr);
        if (senderUnavailable) {
            return res.status(409).json({
                error: "You have marked yourself as unavailable at that time. Please choose a different time slot or update your availability settings.",
                rule:  "sender_unavailable",
            });
        }

        const recipientRow = await pool.query(
            `SELECT first_name FROM users WHERE user_id = $1`, [recipient_id]
        );
        const recipientFirstName = recipientRow.rows[0]?.first_name || "Your match";

        const recipientUnavailable = await checkAvailability(recipient_id, dayOfWeek, timeStr);
        if (recipientUnavailable) {
            return res.status(409).json({
                error: `${recipientFirstName} is not available at that time. Please choose a different time slot.`,
                rule:  "recipient_unavailable",
            });
        }

        const senderResult = await pool.query(
            `SELECT first_name, last_name FROM users WHERE user_id = $1`, [parseInt(sender_id)]
        );
        const senderName = senderResult.rows.length > 0
            ? `${senderResult.rows[0].first_name || ""} ${senderResult.rows[0].last_name || ""}`.trim()
            : "Unknown";

        const scheduleResult = await pool.query(
            `INSERT INTO date_scheduling (match_id, proposed_datetime, venue_type, venue_name, status, created_at)
             VALUES ($1, $2, $3, $4, 'pending', NOW())
                 RETURNING schedule_id`,
            [match_id, proposed_datetime, venue_type, venue_name || null]
        );
        const schedule_id = scheduleResult.rows[0].schedule_id;

        const chatLine = `📅 Date Request: How about ${venue_name || venue_type} on ${new Date(proposed_datetime).toLocaleString()}?`;
        const safety = await evaluateMessage(parseInt(match_id, 10), parseInt(sender_id, 10), recipient_id, chatLine);
        if (safety.decision === "block") {
            await pool.query(`DELETE FROM date_scheduling WHERE schedule_id = $1`, [schedule_id]);
            return res.status(403).json({
                error: safety.reason, blocked: true, reason: safety.reason,
                cooldown: safety.cooldownApplied, cooldown_until: safety.cooldownUntil || null,
            });
        }

        const msgInsert = await pool.query(
            `INSERT INTO message (match_id, sender_id, content, sent_at)
             VALUES ($1, $2, $3, NOW())
                 RETURNING message_id, match_id, sender_id, content, sent_at`,
            [match_id, sender_id, chatLine]
        );
        emitNewChatMessage(match_id, msgInsert.rows[0]);

        await pool.query(
            `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
             VALUES ($1, 'date_request', $2, false, NOW())`,
            [recipient_id, JSON.stringify({
                schedule_id, sender_id: parseInt(sender_id), sender_name: senderName,
                venue_name, proposed_datetime, match_id,
            })]
        );

        const payload = {
            message:       "Date request sent.",
            schedule_id,
            requests_left: 3 - (sentThisWeek + 1),
        };
        if (safety.decision === "prompt") payload.warning = safety.reason;
        res.status(201).json(payload);
    } catch (err) {
        console.error("sendDateRequest error:", err.message);
        res.status(500).json({ error: "Failed to send date request." });
    }
};

exports.respondToDate = async (req, res) => {
    const { scheduleId } = req.params;
    const { response }   = req.body;
    const responderId    = parseInt(req.user.id, 10);

    if (!["approved", "rejected"].includes(response)) {
        return res.status(400).json({ error: "Response must be 'approved' or 'rejected'." });
    }

    try {
        const sid = parseInt(scheduleId, 10);
        if (Number.isNaN(sid)) return res.status(400).json({ error: "Invalid schedule id." });

        const pending = await pool.query(
            `SELECT ds.schedule_id, ds.match_id, ds.proposed_datetime, ds.venue_name, ds.status,
                    m.user1_id, m.user2_id,
                    (SELECT (payload->>'sender_id')::int FROM notifications
                     WHERE type = 'date_request' AND (payload->>'schedule_id')::int = ds.schedule_id
                     LIMIT 1) AS requester_id
             FROM date_scheduling ds
                 JOIN matches m ON m.match_id = ds.match_id
             WHERE ds.schedule_id = $1`,
            [sid]
        );

        if (!pending.rows.length) return res.status(404).json({ error: "Date not found." });

        const pr          = pending.rows[0];
        const u1          = parseInt(pr.user1_id, 10);
        const u2          = parseInt(pr.user2_id, 10);
        const requesterId = pr.requester_id != null ? parseInt(pr.requester_id, 10) : null;

        if (pr.status !== "pending") return res.status(409).json({ error: "This date has already been responded to." });
        if (responderId !== u1 && responderId !== u2) return res.status(403).json({ error: "You are not part of this match." });
        if (requesterId != null && responderId === requesterId) return res.status(403).json({ error: "Only the recipient can respond to this request." });
        if (requesterId == null) return res.status(400).json({ error: "Could not verify the original date request." });

        const other_user_id = responderId === u1 ? u2 : u1;

        // ── If accepting, check if sender is now unavailable ──────────────
        if (response === "approved" && requesterId != null) {
            const dayOfWeek = getDayOfWeek(pr.proposed_datetime);
            const timeStr   = getTimeString(pr.proposed_datetime);
            if (!dayOfWeek || !timeStr) {
                return res.status(400).json({ error: "Invalid proposed_datetime on schedule." });
            }
            const senderNowUnavailable = await checkAvailability(requesterId, dayOfWeek, timeStr);

            if (senderNowUnavailable) {
                await pool.query(
                    `UPDATE date_scheduling SET status = 'rejected' WHERE schedule_id = $1`,
                    [sid]
                );
                await pool.query(
                    `UPDATE notifications SET is_read = true
                     WHERE type = 'date_request' AND (payload->>'schedule_id')::int = $1`,
                    [sid]
                );

                const senderNameRow = await pool.query(
                    `SELECT first_name FROM users WHERE user_id = $1`, [requesterId]
                );
                const senderFirstName = senderNameRow.rows[0]?.first_name || "The requester";

                const chatLine = `📅 Date request was automatically cancelled — ${senderFirstName} is no longer available at that time.`;
                const msgInsert = await pool.query(
                    `INSERT INTO message (match_id, sender_id, content, sent_at)
                     VALUES ($1, $2, $3, NOW())
                         RETURNING message_id, match_id, sender_id, content, sent_at`,
                    [pr.match_id, responderId, chatLine]
                );
                emitNewChatMessage(pr.match_id, msgInsert.rows[0]);

                await pool.query(
                    `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
                     VALUES ($1, 'date_cancelled', $2, false, NOW()),
                            ($3, 'date_cancelled', $2, false, NOW())`,
                    [requesterId, JSON.stringify({
                        schedule_id: sid,
                        venue_name:  pr.venue_name,
                        proposed_datetime: pr.proposed_datetime,
                        reason: "Sender is no longer available at the requested time.",
                    }), responderId]
                );

                return res.status(409).json({
                    error: `${senderFirstName} has since marked themselves as unavailable at that time. The date request has been automatically cancelled.`,
                    auto_cancelled: true,
                });
            }
        }

        const result = await pool.query(
            `UPDATE date_scheduling SET status = $1
             WHERE schedule_id = $2 AND status = 'pending'
                 RETURNING match_id, proposed_datetime, venue_name`,
            [response, sid]
        );

        if (!result.rows.length) return res.status(409).json({ error: "This date has already been responded to." });

        const { match_id, proposed_datetime, venue_name } = result.rows[0];

        if (response === "approved") {
            await pool.query(
                `UPDATE date_scheduling SET scheduled_end_at = proposed_datetime + interval '2 hours' WHERE schedule_id = $1`,
                [sid]
            ).catch(() => {});
        }

        await pool.query(
            `UPDATE notifications SET is_read = true
             WHERE type = 'date_request' AND (payload->>'schedule_id')::int = $1`,
            [sid]
        );

        const responderResult = await pool.query(
            `SELECT first_name, last_name FROM users WHERE user_id = $1`, [responderId]
        );
        const responderName = responderResult.rows.length > 0
            ? `${responderResult.rows[0].first_name || ""} ${responderResult.rows[0].last_name || ""}`.trim()
            : "Your match";

        const statusVerb = response === "approved" ? "accepted" : "declined";
        const chatLine   = `📅 ${responderName} ${statusVerb} the date request.`;

        const msgInsert = await pool.query(
            `INSERT INTO message (match_id, sender_id, content, sent_at)
             VALUES ($1, $2, $3, NOW())
                 RETURNING message_id, match_id, sender_id, content, sent_at`,
            [match_id, responderId, chatLine]
        );
        emitNewChatMessage(match_id, msgInsert.rows[0]);

        if (response === "approved") {
            await pool.query(
                `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
                 VALUES ($1, 'date_accepted', $2, false, NOW())`,
                [other_user_id, JSON.stringify({ schedule_id: sid, venue_name, proposed_datetime, responder_name: responderName })]
            );
            await pool.query(
                `INSERT INTO survey_trigger (schedule_id, user1_id, user2_id, trigger_at, sent, created_at)
                 SELECT $1, $2, $3, ${surveyTriggerAtSql()}, false, NOW()
                 FROM date_scheduling WHERE schedule_id = $1
                     ON CONFLICT (schedule_id) DO NOTHING`,
                [sid, u1, u2]
            );
            await runSurveyTriggers();
        } else {
            await pool.query(
                `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
                 VALUES ($1, 'date_declined', $2, false, NOW())`,
                [other_user_id, JSON.stringify({ schedule_id: sid, venue_name, proposed_datetime, responder_name: responderName })]
            );
        }

        res.json({ message: `Date ${response}.` });
    } catch (err) {
        console.error("respondToDate error:", err.message, err.code || "");
        res.status(500).json({ error: "Failed to respond to date." });
    }
};

exports.getNotifications = async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const jwtId  = parseInt(req.user.id, 10);
    if (Number.isNaN(userId) || userId !== jwtId) return res.status(403).json({ error: "Forbidden." });

    try {
        const result = await pool.query(
            `SELECT notification_id, type, payload, is_read, created_at
             FROM notifications WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 20`,
            [userId]
        );
        const notifications = result.rows.map(n => ({
            ...n,
            payload: typeof n.payload === "string" ? JSON.parse(n.payload) : n.payload,
        }));
        res.json({ notifications });
    } catch (err) {
        console.error("getNotifications error:", err.message);
        res.status(500).json({ error: "Failed to fetch notifications." });
    }
};

exports.markNotificationsRead = async (req, res) => {
    const jwtId = parseInt(req.user.id, 10);
    const uid   = parseInt(req.params.userId, 10);
    if (Number.isNaN(uid) || uid !== jwtId) return res.status(403).json({ error: "Forbidden." });

    const { types, notification_ids: notificationIds, match_id: matchIdRaw } = req.body || {};
    const matchId = parseInt(matchIdRaw, 10);

    try {
        if (Array.isArray(notificationIds) && notificationIds.length > 0) {
            const ids = notificationIds.map(id => parseInt(id, 10)).filter(n => !Number.isNaN(n));
            if (!ids.length) return res.status(400).json({ error: "Invalid notification_ids." });
            await pool.query(
                `UPDATE notifications SET is_read = true WHERE user_id = $1 AND notification_id = ANY($2::int[])`,
                [uid, ids]
            );
        } else if (Array.isArray(types) && types.length > 0) {
            if (types.length === 1 && types[0] === "new_message" && !Number.isNaN(matchId)) {
                await pool.query(
                    `UPDATE notifications SET is_read = true
                     WHERE user_id = $1 AND type = 'new_message' AND is_read = false
                       AND (payload->>'match_id')::int = $2`,
                    [uid, matchId]
                );
            } else {
                await pool.query(
                    `UPDATE notifications SET is_read = true
                     WHERE user_id = $1 AND type = ANY($2::text[]) AND is_read = false`,
                    [uid, types]
                );
            }
        } else {
            return res.status(400).json({ error: "Provide types or notification_ids." });
        }
        res.json({ message: "Updated." });
    } catch (err) {
        console.error("markNotificationsRead error:", err.message);
        res.status(500).json({ error: "Failed to update notifications." });
    }
};

exports.getPostDateSurveyStatus = async (req, res) => {
    const jwtId = parseInt(req.user.id, 10);
    const sid   = parseInt(req.params.scheduleId, 10);
    if (Number.isNaN(sid)) return res.status(400).json({ error: "Invalid schedule id." });

    try {
        const r = await pool.query(
            `SELECT 1 FROM post_date_checkin WHERE schedule_id = $1 AND reviewer_user_id = $2 LIMIT 1`,
            [sid, jwtId]
        );
        res.json({ submitted: r.rows.length > 0 });
    } catch (err) {
        console.error("getPostDateSurveyStatus error:", err.message);
        res.status(500).json({ error: "Failed to check survey status." });
    }
};

exports.submitPostDateSurvey = async (req, res) => {
    const userId = parseInt(req.user.id, 10);
    const { schedule_id, comfortScore, feltSafe, boundariesRespected, feltPressured, wouldSeeAgain, comments } = req.body;

    const comfort = Number(comfortScore);
    if (!schedule_id || !Number.isFinite(comfort) || comfort < 1 || comfort > 5) {
        return res.status(400).json({ error: "schedule_id and comfortScore (1–5) are required." });
    }
    if (!["Yes", "No"].includes(feltSafe) || !["Yes", "No"].includes(boundariesRespected)) {
        return res.status(400).json({ error: "feltSafe and boundariesRespected must be Yes or No." });
    }
    if (!["Yes", "No"].includes(feltPressured) || !["Yes", "No"].includes(wouldSeeAgain)) {
        return res.status(400).json({ error: "feltPressured and wouldSeeAgain must be Yes or No." });
    }

    const shortComment = typeof comments === "string" ? comments.trim().slice(0, 500) : null;

    try {
        const schedResult = await pool.query(
            `SELECT ds.match_id, ds.status, m.user1_id, m.user2_id
             FROM date_scheduling ds JOIN matches m ON m.match_id = ds.match_id
             WHERE ds.schedule_id = $1`,
            [schedule_id]
        );

        if (!schedResult.rows.length) return res.status(404).json({ error: "Schedule not found." });

        const { user1_id, user2_id, status: schedStatus } = schedResult.rows[0];
        if (schedStatus !== "approved") return res.status(409).json({ error: "This date is not approved." });

        const reviewed_user_id = userId === user1_id ? user2_id : user1_id;
        if (userId !== user1_id && userId !== user2_id) return res.status(403).json({ error: "You are not part of this date." });

        const signals = {
            comfort_level:        comfort,
            felt_safe:            feltSafe === "Yes",
            boundaries_respected: boundariesRespected === "Yes",
            felt_pressured:       feltPressured === "Yes",
        };

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const insertResult = await client.query(
                `INSERT INTO post_date_checkin
                 (schedule_id, reviewer_user_id, reviewed_user_id,
                  comfort_level, felt_safe, boundaries_respected,
                  felt_pressured, would_meet_again, short_comment, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                     RETURNING checkin_id`,
                [schedule_id, userId, reviewed_user_id, comfort,
                    signals.felt_safe, signals.boundaries_respected, signals.felt_pressured,
                    wouldSeeAgain, shortComment || null]
            );
            const checkinId   = insertResult.rows[0].checkin_id;
            const trustResult = await applyTrustAfterCheckin(client, reviewed_user_id, checkinId, signals);
            await client.query("COMMIT");

            await pool.query(
                `UPDATE notifications SET is_read = true
                 WHERE user_id = $1 AND type = 'post_date_survey'
                   AND (payload->>'schedule_id')::int = $2`,
                [userId, schedule_id]
            ).catch(() => {});

            if (!trustResult.trust_frozen && trustResult.internal_delta < 0) {
                await pool.query(
                    `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
                     VALUES ($1, 'trust_feedback', $2, false, NOW())`,
                    [reviewed_user_id, JSON.stringify({
                        internal_delta: trustResult.internal_delta,
                        internal_score: trustResult.internal_score,
                    })]
                ).catch(() => {});
            }

            const display = await getTrustDisplayForUser(reviewed_user_id);
            res.status(201).json({ message: "Safety check-in submitted.", trust: trustResult, reviewed: display });
        } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            if (err.code === "23505") return res.status(409).json({ error: "You already submitted a check-in for this date." });
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("submitPostDateSurvey error:", err.message);
        res.status(500).json({ error: "Failed to submit survey." });
    }
};

async function runSurveyTriggers() {
    const result = await pool.query(
        `SELECT st.*, ds.proposed_datetime, ds.venue_name
         FROM survey_trigger st JOIN date_scheduling ds ON ds.schedule_id = st.schedule_id
         WHERE st.sent = false AND st.trigger_at <= NOW()`
    );
    for (const trigger of result.rows) {
        const surveyPayload = JSON.stringify({ schedule_id: trigger.schedule_id, venue_name: trigger.venue_name });
        await pool.query(
            `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
             VALUES ($1, 'post_date_survey', $2, false, NOW()),
                    ($3, 'post_date_survey', $2, false, NOW())`,
            [trigger.user1_id, surveyPayload, trigger.user2_id]
        );
        await pool.query(`UPDATE survey_trigger SET sent = true WHERE schedule_id = $1`, [trigger.schedule_id]);
    }
    return result.rows.length;
}

exports.runSurveyTriggers = runSurveyTriggers;

exports.checkAndSendSurveys = async (req, res) => {
    try {
        const n = await runSurveyTriggers();
        res.json({ triggered: n });
    } catch (err) {
        console.error("checkAndSendSurveys error:", err.message);
        res.status(500).json({ error: "Survey check failed." });
    }
};