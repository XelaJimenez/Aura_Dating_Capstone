const { ni } = require("../utils/pgCoerce");
const scoreMatch = require("./scoreMatch");

const TRUST_PENALTY_THRESHOLD = 55;
const TRUST_PENALTY_AMOUNT = 15;

module.exports = function rankMatches(user, filteredCandidates) {
    return filteredCandidates
        .map(candidate => {
            const result      = scoreMatch(user, candidate);
            let adjustedScore = result.totalScore;

            const trustScore  = ni(candidate.trust_score);
            const isPenalized = trustScore !== null && trustScore <= TRUST_PENALTY_THRESHOLD;
            const visPen      = ni(candidate.visibility_rank_penalty);

            if (isPenalized) {
                adjustedScore = Math.max(0, adjustedScore - TRUST_PENALTY_AMOUNT);
            }
            if (visPen !== null && visPen > 0) {
                adjustedScore = Math.max(0, adjustedScore - visPen);
            }

            return {
                user_id:         Number(candidate.user_id),
                score:           Math.round(adjustedScore),
                raw_score:       Math.round(result.totalScore),
                trust_penalized: isPenalized,
                breakdown:       result.breakdown,
            };
        })
        .sort((a, b) => b.score - a.score);
};