const pool = require("../config/db");
const { resolveAppealAutomatically } = require("../services/appealAutoResolve");

const REASON_KEYS = new Set(["mismatch", "context", "misunderstanding", "inaccurate"]);
const REASON_LABELS = {
    mismatch:         "This doesn’t reflect what happened on the date.",
    context:          "Important context was missing.",
    misunderstanding: "This was a misunderstanding.",
    inaccurate:       "The feedback was inaccurate.",
};
/** Legacy UI sent category + long explanation; map to new keys. */
const LEGACY_CATEGORY_TO_KEY = {
    Misunderstanding: "misunderstanding",
    "False report":   "inaccurate",
    "Context missing": "context",
};

const MAX_EXPLANATION = 320;
const MAX_NOTE = 200;
const MAX_APPEALS_90D = 3;

exports.submitAppeal = async (req, res) => {
    const userId = parseInt(req.user.id, 10);
    const { reason, note, category, explanation } = req.body;

    let reasonKey = typeof reason === "string" ? reason.trim() : "";
    if (!REASON_KEYS.has(reasonKey) && category && LEGACY_CATEGORY_TO_KEY[category]) {
        reasonKey = LEGACY_CATEGORY_TO_KEY[category];
    }
    if (!REASON_KEYS.has(reasonKey)) {
        return res.status(400).json({
            error: "reason must be one of: mismatch, context, misunderstanding, inaccurate.",
        });
    }

    let extraNote = "";
    if (typeof note === "string" && note.trim()) {
        extraNote = note.trim().slice(0, MAX_NOTE);
    } else if (typeof explanation === "string" && explanation.trim() && !note) {
        /** @deprecated open-text path */
        extraNote = explanation.trim().slice(0, MAX_NOTE);
    }

    const label = REASON_LABELS[reasonKey];
    const composed = extraNote.length > 0 ? `${label}\n\n${extraNote}` : label;
    if (composed.length > MAX_EXPLANATION) {
        return res.status(400).json({
            error: `Reason and optional note combined must be at most ${MAX_EXPLANATION} characters.`,
        });
    }

    try {
        const acct = await pool.query(
            `SELECT account_status FROM users WHERE user_id = $1`,
            [userId]
        );
        if (acct.rows.length === 0 || acct.rows[0].account_status !== "active") {
            return res.status(403).json({ error: "Appeals require an active account." });
        }

        const openActions = await pool.query(
            `SELECT action_id FROM moderation_actions WHERE user_id = $1 AND active = true LIMIT 1`,
            [userId]
        );

        let relatedActionId = openActions.rows.length > 0 ? openActions.rows[0].action_id : null;

        if (relatedActionId == null) {
            const safetyFlag = await pool.query(
                `SELECT 1 FROM trust_safety_events
                 WHERE subject_user_id = $1 AND created_at >= NOW() - INTERVAL '90 days'
                 LIMIT 1`,
                [userId]
            );
            if (safetyFlag.rows.length === 0) {
                return res.status(403).json({
                    error:
                        "Appeals are available if the system applied a moderation action to your account, "
                        + "or within 90 days of a safety-related signal from a date check-in about you.",
                });
            }
        }

        const recent = await pool.query(
            `SELECT COUNT(*)::int AS c FROM moderation_appeals
             WHERE user_id = $1
               AND created_at >= NOW() - INTERVAL '90 days'`,
            [userId]
        );
        if ((recent.rows[0]?.c ?? 0) >= MAX_APPEALS_90D) {
            return res.status(429).json({ error: "Maximum appeals reached for this 90-day period." });
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const ins = await client.query(
                `INSERT INTO moderation_appeals
                    (user_id, category, explanation, status, related_action_id, created_at)
                 VALUES ($1, $2, $3, 'pending', $4, NOW())
                 RETURNING appeal_id`,
                [userId, reasonKey, composed, relatedActionId]
            );
            const appealId = ins.rows[0].appeal_id;

            const resolution = await resolveAppealAutomatically(client, userId, appealId);

            await client.query("COMMIT");
            res.status(201).json({
                message: resolution.summary,
                appeal_id: appealId,
                resolution: {
                    outcome: resolution.outcome,
                    summary: resolution.summary,
                    banned: resolution.banned,
                    public_trust_rating: resolution.public_trust_rating,
                    internal_score: resolution.internal_score,
                },
            });
        } catch (e) {
            await client.query("ROLLBACK").catch(() => {});
            if (e.message === "User not found" || e.message === "Trust score missing") {
                return res.status(400).json({ error: e.message });
            }
            if (e.message === "Account is not active") {
                return res.status(403).json({ error: "Account is not active." });
            }
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("submitAppeal error:", err.message);
        res.status(500).json({ error: "Failed to submit appeal." });
    }
};

exports.getAppealEligibility = async (req, res) => {
    const userId = parseInt(req.user.id, 10);
    try {
        const acct = await pool.query(
            `SELECT account_status FROM users WHERE user_id = $1`,
            [userId]
        );
        if (acct.rows.length === 0 || acct.rows[0].account_status !== "active") {
            return res.json({ eligible: false, reason: "account_inactive" });
        }

        const mod = await pool.query(
            `SELECT 1 FROM moderation_actions WHERE user_id = $1 AND active = true LIMIT 1`,
            [userId]
        );
        if (mod.rows.length > 0) {
            return res.json({ eligible: true, reason: "moderation_action" });
        }
        const se = await pool.query(
            `SELECT 1 FROM trust_safety_events
             WHERE subject_user_id = $1 AND created_at >= NOW() - INTERVAL '90 days'
             LIMIT 1`,
            [userId]
        );
        if (se.rows.length > 0) {
            return res.json({ eligible: true, reason: "safety_flag" });
        }
        res.json({ eligible: false });
    } catch (err) {
        console.error("getAppealEligibility error:", err.message);
        res.status(500).json({ error: "Failed to check eligibility." });
    }
};

exports.listMyAppeals = async (req, res) => {
    const userId = parseInt(req.user.id, 10);
    try {
        const r = await pool.query(
            `SELECT appeal_id, category, explanation, status, outcome, created_at, resolved_at
             FROM moderation_appeals
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 20`,
            [userId]
        );
        res.json({ appeals: r.rows });
    } catch (err) {
        console.error("listMyAppeals error:", err.message);
        res.status(500).json({ error: "Failed to load appeals." });
    }
};
