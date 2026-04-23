/**
 * No admin dashboard: resolve appeals immediately from current trust scores.
 * Uses public trust (1–5) when the user has enough date reviews; otherwise internal (0–100).
 */

const { MIN_DATES_FOR_PUBLIC } = require("./trustService");

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}

/**
 * @param {import("pg").PoolClient} client
 * @param {number} userId
 * @param {number} appealId
 * @returns {Promise<{ outcome: string, summary: string, banned: boolean, public_trust_rating: number|null, internal_score: number }>}
 */
async function resolveAppealAutomatically(client, userId, appealId) {
    const urow = await client.query(
        `SELECT account_status FROM users WHERE user_id = $1`,
        [userId]
    );
    if (urow.rows.length === 0) {
        throw new Error("User not found");
    }
    if (urow.rows[0].account_status !== "active") {
        throw new Error("Account is not active");
    }

    const ts = await client.query(
        `SELECT internal_score, public_trust_rating FROM trust_score WHERE user_id = $1`,
        [userId]
    );
    if (ts.rows.length === 0) {
        throw new Error("Trust score missing");
    }

    const datesQ = await client.query(
        `SELECT COUNT(DISTINCT schedule_id)::int AS c
         FROM post_date_checkin WHERE reviewed_user_id = $1 AND schedule_id IS NOT NULL`,
        [userId]
    );
    const datesN = datesQ.rows[0]?.c ?? 0;

    let internal = ts.rows[0].internal_score != null ? Number(ts.rows[0].internal_score) : 75;
    const pubRaw = ts.rows[0].public_trust_rating;
    const pub = pubRaw != null ? Number(pubRaw) : null;

    let outcome;
    let summary;
    let banned = false;
    let newInternal = internal;
    let newPub = pub;

    const usePublic = pub != null && datesN >= MIN_DATES_FOR_PUBLIC;

    if (usePublic) {
        if (pub >= 4) {
            outcome = "auto_approved";
            newPub = clamp(pub + 0.08, 1, 5);
            newInternal = clamp(internal + 2, 0, 100);
            summary =
                "Appeal approved. Your public trust was adjusted slightly in your favor (automated review).";
        } else if (pub < 2) {
            outcome = "auto_banned";
            banned = true;
            await client.query(`UPDATE users SET account_status = 'banned' WHERE user_id = $1`, [userId]);
            summary =
                "Trust was very low. Your account has been closed after this appeal (automated review).";
        } else {
            outcome = "auto_penalty";
            newPub = clamp(pub - 0.75, 1, 5);
            newInternal = clamp(internal - 18, 0, 100);
            summary =
                "Appeal processed. An additional trust adjustment was applied (automated review).";
        }
    } else {
        if (internal >= 80) {
            outcome = "auto_approved";
            newInternal = clamp(internal + 2, 0, 100);
            if (pub != null) newPub = clamp(pub + 0.05, 1, 5);
            summary =
                "Appeal approved. A small internal trust adjustment was applied (automated review).";
        } else if (internal < 25) {
            outcome = "auto_banned";
            banned = true;
            await client.query(`UPDATE users SET account_status = 'banned' WHERE user_id = $1`, [userId]);
            summary =
                "Trust was very low. Your account has been closed after this appeal (automated review).";
        } else {
            outcome = "auto_penalty";
            newInternal = clamp(internal - 22, 0, 100);
            if (pub != null) newPub = clamp(pub - 0.6, 1, 5);
            summary =
                "Appeal processed. A significant trust reduction was applied (automated review).";
        }
    }

    if (!banned) {
        await client.query(
            `UPDATE trust_score SET
                internal_score = $1,
                public_trust_rating = $2,
                last_updated = NOW(),
                trust_frozen_until = NULL,
                freeze_reason = NULL
             WHERE user_id = $3`,
            [newInternal, newPub, userId]
        );
    } else {
        await client.query(
            `UPDATE trust_score SET trust_frozen_until = NULL, freeze_reason = NULL WHERE user_id = $1`,
            [userId]
        );
    }

    await client.query(
        `UPDATE moderation_appeals
         SET status = 'resolved', outcome = $1, resolved_at = NOW(), reviewer_note = $2
         WHERE appeal_id = $3`,
        [outcome, summary, appealId]
    );

    return {
        outcome,
        summary,
        banned,
        public_trust_rating: banned ? pub : newPub,
        internal_score: banned ? internal : newInternal,
    };
}

module.exports = { resolveAppealAutomatically };
