const { ni } = require("../utils/pgCoerce");
const { milesBetween } = require("../utils/geoDistance");
const { normalizePreferredGenderIds } = require("./preferredGenderIds");

const TRUST_ELIMINATION_THRESHOLD = 40;

let openToAllPartnerGenderTypeId = 6;

async function ensureOpenToAllPartnerGenderTypeId(pool) {
    if (!pool || typeof pool.query !== "function") return;
    try {
        const r = await pool.query(
            `SELECT gender_type_id FROM gender_type WHERE gender_name = $1 LIMIT 1`,
            ["Open to all"]
        );
        if (r.rows[0] && r.rows[0].gender_type_id != null) {
            const n = ni(r.rows[0].gender_type_id);
            if (n !== null) openToAllPartnerGenderTypeId = n;
        }
    } catch {
        /* keep default */
    }
}

function normalizeGenderIdList(raw) {
    return normalizePreferredGenderIds(raw);
}

function prefListTreatsPartnerGenderAsOpenToAll(preferred) {
    const p = normalizeGenderIdList(preferred);
    return p.some((id) => ni(id) === ni(openToAllPartnerGenderTypeId));
}

function getAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const dob   = new Date(dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function genderMatch(user, candidate) {
    const preferred = normalizeGenderIdList(user.preferences?.preferred_genders);
    if (preferred.length === 0) return true;
    if (prefListTreatsPartnerGenderAsOpenToAll(preferred)) {
        return ni(candidate.gender_identity) !== null;
    }
    const cg = ni(candidate.gender_identity);
    if (cg === null) return false;
    return preferred.includes(cg);
}

function isOpenToAllIdentity(user) {
    const n = (user.gender_name || "").trim().toLowerCase();
    return n === "open to all";
}

function candidatePrefAcceptsViewerGender(candidatePreferred, viewerGenderId) {
    const p = normalizeGenderIdList(candidatePreferred);
    if (p.length === 0) return true;
    if (prefListTreatsPartnerGenderAsOpenToAll(p)) {
        return ni(viewerGenderId) !== null;
    }
    const ug = ni(viewerGenderId);
    if (ug === null) return false;
    return p.includes(ug);
}

function seekOverlapsCandidatePartnerPrefs(seek, candidatePreferred) {
    const s = normalizeGenderIdList(seek);
    const c = normalizeGenderIdList(candidatePreferred);
    if (s.length === 0) return false;
    if (prefListTreatsPartnerGenderAsOpenToAll(s) || prefListTreatsPartnerGenderAsOpenToAll(c)) {
        return true;
    }
    return s.some((sid) => c.some((cid) => ni(sid) === ni(cid)));
}

function mutualGenderMatch(user, candidate) {
    if (!genderMatch(user, candidate)) return false;
    const candidatePreferred = normalizeGenderIdList(candidate.preferences?.preferred_genders);
    if (candidatePreferred.length === 0) return true;
    const ug = ni(user.gender_identity);
    if (ug === null) return false;

    if (isOpenToAllIdentity(user)) {
        const seek = normalizeGenderIdList(user.preferences?.preferred_genders);
        if (seek.length > 0) {
            const seekAsViewer = {
                user_id: user.user_id,
                preferences: { preferred_genders: seek },
            };
            if (!genderMatch(seekAsViewer, candidate)) return false;
        }

        if (candidatePrefAcceptsViewerGender(candidatePreferred, ug)) return true;

        if (seek.length > 0) {
            return seekOverlapsCandidatePartnerPrefs(seek, candidatePreferred);
        }

        return true;
    }

    return candidatePrefAcceptsViewerGender(candidatePreferred, ug);
}

function distanceCompatible(user, candidate, prefs) {
    const min = ni(prefs?.min_distance_miles);
    const max = ni(prefs?.max_distance_miles);
    if (min === null && max === null) return true;
    const dist = milesBetween(user.latitude, user.longitude, candidate.latitude, candidate.longitude);
    if (dist === null) return true;
    if (min !== null && dist < min) return false;
    if (max !== null && dist > max) return false;
    return true;
}

function filterMatches(user, candidates) {
    const prefs = user.preferences;

    return candidates.filter(candidate => {
        const uid = ni(user.user_id);
        const cid = ni(candidate.user_id);
        if (uid !== null && cid !== null && uid === cid) return false;

        const trust = ni(candidate.trust_score);
        if (trust !== null && trust <= TRUST_ELIMINATION_THRESHOLD) {
            return false;
        }

        if (candidate.account_status !== "active") return false;

        if (!mutualGenderMatch(user, candidate)) return false;

        if (!prefs) return true;

        const candidateAge = getAge(candidate.date_of_birth);
        const ageMin = ni(prefs.preferred_age_min);
        const ageMax = ni(prefs.preferred_age_max);
        if (ageMin !== null && candidateAge !== null && candidateAge < ageMin) return false;
        if (ageMax !== null && candidateAge !== null && candidateAge > ageMax) return false;

        const hMin = ni(prefs.preferred_height_min);
        const hMax = ni(prefs.preferred_height_max);
        const ch = ni(candidate.height_inches);
        if (hMin !== null && ch !== null && ch < hMin) return false;
        if (hMax !== null && ch !== null && ch > hMax) return false;

        /**
         * Partner religion / politics / ethnicity / dating goals / children / family are soft signals
         * (reflected in match score), not hard deck filters — avoids empty stacks after partial profile
         * saves or label/ID drift while keeping age, height, and distance as hard constraints.
         */

        if (!distanceCompatible(user, candidate, prefs)) return false;

        return true;
    });
}

filterMatches.TRUST_ELIMINATION_THRESHOLD = TRUST_ELIMINATION_THRESHOLD;
filterMatches.ensureOpenToAllPartnerGenderTypeId = ensureOpenToAllPartnerGenderTypeId;
module.exports = filterMatches;
