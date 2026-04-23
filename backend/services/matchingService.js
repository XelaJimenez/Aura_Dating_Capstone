const filterMatches = require("../matching/filterMatches");
const rankMatches   = require("../matching/rankMatches");
const scoreMatch    = require("../matching/scoreMatch");
const { normalizePreferredGenderIds } = require("../matching/preferredGenderIds");
const { ni } = require("../utils/pgCoerce");
const pool          = require("../config/db");

async function attachCandidatePreferences(candidates) {
    return Promise.all(candidates.map(async (candidate) => {
        const result = await pool.query(
            `SELECT
                p.preference_id,
                p.preferred_age_min,
                p.preferred_age_max,
                p.preferred_dating_goals,
                p.preferred_want_children,
                p.preferred_smoking,
                p.preferred_height_min,
                p.preferred_height_max,
                p.preferred_religion_type_id,
                p.preferred_ethnicity_id,
                p.preferred_political_affil,
                p.preferred_family_oriented,
                rt_pref.religion_name AS preferred_religion_label,
                et_pref.ethnicity_name AS preferred_ethnicity_label,
                dg_pref.dating_goal_name AS preferred_dating_goals_label,
                wc_pref.want_children AS preferred_want_children_label,
                pa_pref.political_affil AS preferred_political_label,
                fo_pref.family_oriented_name AS preferred_family_oriented_label,
                (SELECT array_agg(pg.gender_type_id) FILTER (WHERE pg.gender_type_id IS NOT NULL)
                   FROM preference_genders pg WHERE pg.preference_id = p.preference_id) AS preferred_genders
             FROM preferences p
             LEFT JOIN religion_type   rt_pref ON rt_pref.religion_type_id     = p.preferred_religion_type_id
             LEFT JOIN ethnicity_type  et_pref ON et_pref.ethnicity_type_id    = p.preferred_ethnicity_id
             LEFT JOIN dating_goals    dg_pref ON dg_pref.dating_goals_id      = p.preferred_dating_goals
             LEFT JOIN want_children   wc_pref ON wc_pref.want_children_id     = p.preferred_want_children
             LEFT JOIN political_affil pa_pref ON pa_pref.political_affil_id   = p.preferred_political_affil
             LEFT JOIN family_oriented fo_pref ON fo_pref.family_oriented_id   = p.preferred_family_oriented
             WHERE p.user_id = $1`,
            [candidate.user_id]
        );

        const pref = result.rows[0] || null;
        if (pref) {
            pref.preferred_genders = normalizePreferredGenderIds(pref.preferred_genders);
        }
        return {
            ...candidate,
            preferences: pref
        };
    }));
}

function candidateMapFromRows(rows) {
    const m = new Map();
    for (const c of rows) {
        const id = ni(c.user_id);
        if (id !== null) m.set(String(id), c);
    }
    return m;
}

module.exports = async function generateMatches(user, candidates, shouldRank = true) {
    const viewerTrust = ni(user.trust_score);
    if (viewerTrust !== null && viewerTrust <= filterMatches.TRUST_ELIMINATION_THRESHOLD) {
        return { matches: [], candidateByUserId: new Map() };
    }

    await filterMatches.ensureOpenToAllPartnerGenderTypeId(pool);

    const candidatesWithPrefs = await attachCandidatePreferences(candidates);

    const filtered = filterMatches(user, candidatesWithPrefs);
    const candidateByUserId = candidateMapFromRows(filtered);

    if (!shouldRank) {
        const matches = filtered.map(candidate => {
            const result = scoreMatch(user, candidate);
            return {
                user_id:         Number(candidate.user_id),
                score:           Math.round(result.totalScore),
                raw_score:       Math.round(result.totalScore),
                trust_penalized: false,
                breakdown:       result.breakdown
            };
        });
        return { matches, candidateByUserId };
    }

    const matches = rankMatches(user, filtered);
    return { matches, candidateByUserId };
};