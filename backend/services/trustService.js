/**
 * Feature 2: Safety-weighted trust scoring, public rating, pattern moderation.
 * Only structured safety fields affect scores; optional comments are moderation-only.
 */

const pool = require("../config/db");

const ROLLING_WINDOW = 10;
const MIN_DATES_FOR_PUBLIC = 3;
const MAX_PUBLIC_DROP_PER_EVENT = 0.3;
const PRESSURE_LOOKBACK_DAYS = 90;
const PRESSURE_REPORTS_FOR_MOD = 3;
const SAFETY_FLAG_WINDOW_DAYS = 7;
const SAFETY_FLAGS_FOR_WARNING = 2;
const VERY_LOW_TRUST = 25;

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}

/** Weighted internal delta from safety fields only (spec Rule 2). */
function computeInternalDelta(signals) {
    const comfort = Number(signals.comfort_level);
    let delta = 0;
    if (signals.felt_safe === true) delta += 2;
    if (signals.felt_safe === false) delta -= 5;
    if (signals.boundaries_respected === true) delta += 2;
    if (signals.boundaries_respected === false) delta -= 4;
    if (signals.felt_pressured === true) delta -= 3;
    if (Number.isFinite(comfort) && comfort >= 4) delta += 1;
    return delta;
}

/** Map internal delta to a 1–5 session score for rolling public average. */
function deltaToSessionPublicScore(delta) {
    const minD = -12;
    const maxD = 5;
    const t = (delta - minD) / (maxD - minD);
    return clamp(1 + t * 4, 1, 5);
}

function trustLabelFromPublic(publicRating, datesReviewed) {
    if (datesReviewed < MIN_DATES_FOR_PUBLIC || publicRating == null) {
        return { label: "New User", show_numeric: false, shield_count: null };
    }
    const r = Number(publicRating);
    let label = "Limited Trust";
    if (r >= 4.2) label = "Highly Trusted";
    else if (r >= 3.4) label = "Trusted";
    const shield_count = clamp(Math.round(r), 1, 5);
    return { label, show_numeric: true, shield_count, public_trust_rating: Math.round(r * 10) / 10 };
}

async function countDistinctDatesReviewed(client, userId) {
    const r = await client.query(
        `SELECT COUNT(DISTINCT schedule_id)::int AS c
         FROM post_date_checkin
         WHERE reviewed_user_id = $1 AND schedule_id IS NOT NULL`,
        [userId]
    );
    return r.rows[0]?.c ?? 0;
}

async function recomputePublicTrustRating(client, reviewedUserId, previousPublic) {
    const history = await client.query(
        `SELECT comfort_level, felt_safe, boundaries_respected, felt_pressured
         FROM post_date_checkin
         WHERE reviewed_user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [reviewedUserId, ROLLING_WINDOW]
    );
    if (history.rows.length === 0) return { public_trust_rating: null, capped: false };

    const sessions = history.rows.map((row) =>
        deltaToSessionPublicScore(
            computeInternalDelta({
                comfort_level: row.comfort_level,
                felt_safe: row.felt_safe,
                boundaries_respected: row.boundaries_respected,
                felt_pressured: row.felt_pressured,
            })
        )
    );
    let avg = sessions.reduce((a, b) => a + b, 0) / sessions.length;

    let capped = false;
    if (previousPublic != null && avg < previousPublic - MAX_PUBLIC_DROP_PER_EVENT) {
        avg = previousPublic - MAX_PUBLIC_DROP_PER_EVENT;
        capped = true;
    }
    return { public_trust_rating: Math.round(avg * 100) / 100, capped };
}

async function isTrustFrozen(client, userId) {
    const r = await client.query(
        `SELECT trust_frozen_until FROM trust_score WHERE user_id = $1`,
        [userId]
    );
    if (r.rows.length === 0) return false;
    const u = r.rows[0].trust_frozen_until;
    if (!u) return false;
    return new Date(u) > new Date();
}

async function recordSafetyEvents(client, subjectUserId, checkinId, signals) {
    if (signals.felt_pressured === true) {
        await client.query(
            `INSERT INTO trust_safety_events (subject_user_id, checkin_id, event_type)
             VALUES ($1, $2, 'pressure')`,
            [subjectUserId, checkinId]
        );
    }
    if (signals.felt_safe === false) {
        await client.query(
            `INSERT INTO trust_safety_events (subject_user_id, checkin_id, event_type)
             VALUES ($1, $2, 'unsafe')`,
            [subjectUserId, checkinId]
        );
    }
    if (signals.boundaries_respected === false) {
        await client.query(
            `INSERT INTO trust_safety_events (subject_user_id, checkin_id, event_type)
             VALUES ($1, $2, 'boundary')`,
            [subjectUserId, checkinId]
        );
    }
}

async function applyPatternModeration(client, subjectUserId) {
    const since = new Date(Date.now() - SAFETY_FLAG_WINDOW_DAYS * 864e5);
    const flagRes = await client.query(
        `SELECT COUNT(*)::int AS c FROM trust_safety_events
         WHERE subject_user_id = $1 AND created_at >= $2
           AND event_type IN ('unsafe', 'boundary', 'pressure')`,
        [subjectUserId, since]
    );
    const flags7d = flagRes.rows[0]?.c ?? 0;

    const urow = await client.query(
        `SELECT moderation_warning_logged FROM users WHERE user_id = $1`,
        [subjectUserId]
    );
    const warned = urow.rows[0]?.moderation_warning_logged === true;

    if (flags7d >= SAFETY_FLAGS_FOR_WARNING && !warned) {
        await client.query(
            `UPDATE users SET moderation_warning_logged = true WHERE user_id = $1`,
            [subjectUserId]
        );
        const exists = await client.query(
            `SELECT 1 FROM moderation_actions
             WHERE user_id = $1 AND action_type = 'warning_pattern' AND active = true LIMIT 1`,
            [subjectUserId]
        );
        if (exists.rows.length === 0) {
            await client.query(
                `INSERT INTO moderation_actions (user_id, action_type, reason, active)
                 VALUES ($1, 'warning_pattern', $2, true)`,
                [
                    subjectUserId,
                    "Multiple safety-related signals within 7 days — pattern logged for review.",
                ]
            );
        }
    }

    const pressureSince = new Date(Date.now() - PRESSURE_LOOKBACK_DAYS * 864e5);
    const pressRes = await client.query(
        `SELECT COUNT(DISTINCT pdc.reviewer_user_id)::int AS c
         FROM trust_safety_events e
         JOIN post_date_checkin pdc ON pdc.checkin_id = e.checkin_id
         WHERE e.subject_user_id = $1
           AND e.event_type = 'pressure'
           AND e.created_at >= $2`,
        [subjectUserId, pressureSince]
    );
    const distinctPressure = pressRes.rows[0]?.c ?? 0;
    if (distinctPressure >= PRESSURE_REPORTS_FOR_MOD) {
        const exists = await client.query(
            `SELECT 1 FROM moderation_actions
             WHERE user_id = $1 AND action_type = 'moderation_review_pressure' AND active = true LIMIT 1`,
            [subjectUserId]
        );
        if (exists.rows.length === 0) {
            await client.query(
                `UPDATE users SET
                    trust_matching_restricted = true,
                    trust_public_dates_only = true,
                    visibility_rank_penalty = GREATEST(visibility_rank_penalty, 25)
                 WHERE user_id = $1`,
                [subjectUserId]
            );
            await client.query(
                `INSERT INTO moderation_actions (user_id, action_type, reason, active)
                 VALUES ($1, 'moderation_review_pressure', $2, true)`,
                [
                    subjectUserId,
                    "Repeated independent pressure reports — matching restricted pending review.",
                ]
            );
        }
    }

    const ts = await client.query(
        `SELECT internal_score FROM trust_score WHERE user_id = $1`,
        [subjectUserId]
    );
    const internal = ts.rows[0]?.internal_score;
    if (internal != null && internal <= VERY_LOW_TRUST) {
        const exists = await client.query(
            `SELECT 1 FROM moderation_actions
             WHERE user_id = $1 AND action_type = 'low_trust_restrictions' AND active = true LIMIT 1`,
            [subjectUserId]
        );
        if (exists.rows.length === 0) {
            await client.query(
                `UPDATE users SET
                    trust_matching_restricted = true,
                    trust_public_dates_only = true,
                    premium_suspended = true,
                    visibility_rank_penalty = GREATEST(visibility_rank_penalty, 40)
                 WHERE user_id = $1`,
                [subjectUserId]
            );
            await client.query(
                `INSERT INTO moderation_actions (user_id, action_type, reason, active)
                 VALUES ($1, 'low_trust_restrictions', $2, true)`,
                [
                    subjectUserId,
                    "Very low internal trust score — matching and premium limits applied.",
                ]
            );
        }
    }
}

/**
 * Process check-in after row insert: update scores, patterns, moderation.
 * @param {object} pg - pool or client (must support query)
 * @param {number} reviewedUserId
 * @param {number} checkinId
 * @param {object} signals - comfort_level, felt_safe, boundaries_respected, felt_pressured
 */
async function applyTrustAfterCheckin(pg, reviewedUserId, checkinId, signals) {
    const client = pg;
    const frozen = await isTrustFrozen(client, reviewedUserId);

    if (frozen) {
        return {
            trust_frozen: true,
            internal_delta: 0,
            internal_score: null,
            public_trust_rating: null,
        };
    }

    await recordSafetyEvents(client, reviewedUserId, checkinId, signals);

    const delta = computeInternalDelta(signals);
    const prevRow = await client.query(
        `SELECT internal_score, public_trust_rating FROM trust_score WHERE user_id = $1`,
        [reviewedUserId]
    );
    if (prevRow.rows.length === 0) {
        throw new Error("trust_score row missing for user");
    }
    const previousInternal = prevRow.rows[0].internal_score;
    const previousPublic = prevRow.rows[0].public_trust_rating != null
        ? Number(prevRow.rows[0].public_trust_rating)
        : null;

    const newInternal = clamp((previousInternal ?? 75) + delta, 0, 100);

    await client.query(
        `INSERT INTO trust_score_history (user_id, score_before, score_after, change_reason, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [reviewedUserId, previousInternal, newInternal, "post_date_checkin"]
    );

    const { public_trust_rating } = await recomputePublicTrustRating(
        client,
        reviewedUserId,
        previousPublic
    );

    const datesN = await countDistinctDatesReviewed(client, reviewedUserId);
    const pubToStore = datesN >= MIN_DATES_FOR_PUBLIC ? public_trust_rating : null;

    await client.query(
        `UPDATE trust_score SET internal_score = $1, public_trust_rating = $2, last_updated = NOW()
         WHERE user_id = $3`,
        [newInternal, pubToStore, reviewedUserId]
    );

    await applyPatternModeration(client, reviewedUserId);

    return {
        trust_frozen: false,
        internal_delta: delta,
        internal_score: newInternal,
        public_trust_rating: pubToStore,
        dates_reviewed: datesN,
    };
}

async function getTrustDisplayForUser(userId) {
    const r = await pool.query(
        `SELECT ts.internal_score, ts.public_trust_rating,
                (SELECT COUNT(DISTINCT schedule_id)::int FROM post_date_checkin p
                 WHERE p.reviewed_user_id = $1 AND p.schedule_id IS NOT NULL) AS dates_reviewed
         FROM trust_score ts WHERE ts.user_id = $1`,
        [userId]
    );
    if (r.rows.length === 0) return null;
    const row = r.rows[0];
    const datesReviewed = row.dates_reviewed ?? 0;
    const pub = row.public_trust_rating != null ? Number(row.public_trust_rating) : null;
    const lbl = trustLabelFromPublic(pub, datesReviewed);
    return {
        internal_score: row.internal_score,
        public_trust_rating: pub,
        dates_reviewed: datesReviewed,
        ...lbl,
    };
}

module.exports = {
    computeInternalDelta,
    deltaToSessionPublicScore,
    trustLabelFromPublic,
    recomputePublicTrustRating,
    applyTrustAfterCheckin,
    getTrustDisplayForUser,
    MIN_DATES_FOR_PUBLIC,
    ROLLING_WINDOW,
};
