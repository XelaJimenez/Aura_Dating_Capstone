const pool = require("../config/db");
const { applyTrustAfterCheckin, getTrustDisplayForUser } = require("../services/trustService");

exports.submitCheckin = async (req, res) => {
    const reviewer_user_id = parseInt(req.user.id, 10);
    const {
        reviewed_user_id,
        schedule_id,
        comfort_level,
        felt_safe,
        boundaries_respected,
        felt_pressured,
        would_meet_again,
        short_comment,
    } = req.body;

    const comfort = Number(comfort_level);
    if (!reviewed_user_id || !schedule_id || !Number.isFinite(comfort) || comfort < 1 || comfort > 5) {
        return res.status(400).json({ error: "reviewed_user_id, schedule_id, and comfort_level (1–5) are required." });
    }
    if (!["Yes", "No"].includes(felt_safe) || !["Yes", "No"].includes(boundaries_respected)) {
        return res.status(400).json({ error: "felt_safe and boundaries_respected must be Yes or No." });
    }
    if (!["Yes", "No"].includes(felt_pressured) || !["Yes", "No"].includes(would_meet_again)) {
        return res.status(400).json({ error: "felt_pressured and would_meet_again must be Yes or No." });
    }

    const comment =
        typeof short_comment === "string" ? short_comment.trim().slice(0, 500) : null;

    try {
        const schedResult = await pool.query(
            `SELECT ds.status, m.user1_id, m.user2_id
             FROM date_scheduling ds
             JOIN matches m ON m.match_id = ds.match_id
             WHERE ds.schedule_id = $1`,
            [schedule_id]
        );
        if (schedResult.rows.length === 0) {
            return res.status(404).json({ error: "Schedule not found." });
        }
        const { user1_id, user2_id, status: schedStatus } = schedResult.rows[0];
        if (schedStatus !== "approved") {
            return res.status(409).json({ error: "This date is not approved." });
        }
        if (reviewer_user_id !== user1_id && reviewer_user_id !== user2_id) {
            return res.status(403).json({ error: "You are not part of this date." });
        }
        const expectedOther = reviewer_user_id === user1_id ? user2_id : user1_id;
        if (parseInt(reviewed_user_id, 10) !== expectedOther) {
            return res.status(400).json({ error: "reviewed_user_id must be your date partner for this schedule." });
        }

        const signals = {
            comfort_level: comfort,
            felt_safe: felt_safe === "Yes",
            boundaries_respected: boundaries_respected === "Yes",
            felt_pressured: felt_pressured === "Yes",
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
                [
                    schedule_id,
                    reviewer_user_id,
                    reviewed_user_id,
                    comfort,
                    signals.felt_safe,
                    signals.boundaries_respected,
                    signals.felt_pressured,
                    would_meet_again,
                    comment || null,
                ]
            );
            const checkinId = insertResult.rows[0].checkin_id;
            const trustResult = await applyTrustAfterCheckin(client, reviewed_user_id, checkinId, signals);
            await client.query("COMMIT");

            const display = await getTrustDisplayForUser(reviewed_user_id);
            res.status(201).json({
                message: "Check-in submitted.",
                trust: trustResult,
                reviewed: display,
            });
        } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            if (err.code === "23505") {
                return res.status(409).json({ error: "You already submitted a check-in for this date." });
            }
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("submitCheckin error:", err.message);
        res.status(500).json({ error: "Failed to submit check-in." });
    }
};

/** No reviewer identities (reviewer anonymity). */
exports.getCheckinSummary = async (req, res) => {
    const targetId = parseInt(req.params.user_id, 10);
    const selfId = parseInt(req.user.id, 10);
    if (targetId !== selfId) {
        return res.status(403).json({ error: "You can only view your own check-in summary." });
    }

    try {
        const result = await pool.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(DISTINCT schedule_id)::int AS dates_with_feedback
             FROM post_date_checkin
             WHERE reviewed_user_id = $1`,
            [targetId]
        );
        res.json({ summary: result.rows[0] });
    } catch (err) {
        console.error("getCheckinSummary error:", err.message);
        res.status(500).json({ error: "Failed to fetch summary." });
    }
};
