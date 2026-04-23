const generateMatches = require("../services/matchingService");
const filterMatches = require("../matching/filterMatches");
const { getUserById, getCandidates } = require("../services/userService");
const pool = require("../config/db");
const { trustLabelFromPublic, getTrustDisplayForUser, MIN_DATES_FOR_PUBLIC } = require("../services/trustService");
const { milesBetween } = require("../utils/geoDistance");
const { ni } = require("../utils/pgCoerce");

const TRUST_ELIMINATION_THRESHOLD = filterMatches.TRUST_ELIMINATION_THRESHOLD;

const LIKE_LIMITS = { 1: 3, 2: 5 };

/** Swipes / prefs must use the logged-in user from JWT — not :userId (stale client localStorage breaks matches). */
function authedUserId(req) {
    const raw = req.user && req.user.id;
    if (raw === undefined || raw === null || raw === "") return null;
    const n = parseInt(String(raw), 10);
    return Number.isNaN(n) ? null : n;
}

function getAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const dob = new Date(dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

/** Public safety shield count (1–5) + label; hidden until enough date feedback exists. */
function publicTrustUi(candidate) {
    const dates = Number(candidate.trust_dates_reviewed) || 0;
    const pub = candidate.public_trust_rating != null
        ? Number(candidate.public_trust_rating)
        : null;
    const t = trustLabelFromPublic(pub, dates);
    return {
        shield_rating: t.shield_count,
        trust_label: t.label,
        trust_dates_reviewed: dates,
        public_trust_rating: t.show_numeric ? t.public_trust_rating : null,
        safety_based_rating: true,
    };
}

function internalToShield(internalScore) {
    if (internalScore == null || internalScore === "") return null;
    const n = Number(internalScore);
    if (!Number.isFinite(n)) return null;
    return Math.max(1, Math.min(5, Math.round(n / 20)));
}

/** Shield fill count for cards — prefer public trust rules, then legacy internal-score stars. */
function computeTrustShieldDisplay(td, fallback, c) {
    const merged = td?.shield_count ?? fallback?.shield_rating;
    if (merged != null && merged !== "") {
        const n = Number(merged);
        if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
    }
    const dates = Number(c.trust_dates_reviewed) || 0;
    const pub = c.public_trust_rating != null ? Number(c.public_trust_rating) : null;
    if (dates >= MIN_DATES_FOR_PUBLIC && pub != null && Number.isFinite(pub)) {
        return Math.max(1, Math.min(5, Math.round(pub)));
    }
    const fromInternal = internalToShield(td?.internal_score ?? c?.trust_score);
    if (fromInternal != null) return fromInternal;
    return null;
}

function inchesToDisplay(inches) {
    if (!inches) return null;
    const ft = Math.floor(inches / 12);
    const inch = inches % 12;
    return `${ft}'${inch}"`;
}

/** Daily like cap uses a rolling 24-hour window from each swipe's created_at (not calendar midnight). */
async function getLikesToday(userId) {
    const result = await pool.query(
        `SELECT COUNT(*) AS count FROM swipes
         WHERE swipe_user_id = $1 AND swipe_type = 'like'
           AND created_at >= NOW() - INTERVAL '24 hours'`,
        [userId]
    );
    return parseInt(result.rows[0].count);
}

exports.getAllCandidates = async (req, res) => {
    try {
        const candidates = await getCandidates(0);
        res.json(candidates);
    } catch (err) {
        console.error("getAllCandidates error:", err.message);
        res.status(500).json({ error: "Failed to fetch candidates" });
    }
};

exports.getMatches = async (req, res) => {
    try {
        const userId = authedUserId(req);
        if (userId == null) return res.status(401).json({ error: "Unauthorized" });

        const shouldRank = req.query.ranked !== "false";
        const user = await getUserById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.account_status && user.account_status !== "active") {
            return res.status(403).json({
                error: "Account is not active.",
                user_id: userId,
                total_matches: 0,
                matches: [],
                likes_today: 0,
                likes_left: 0,
                tier_limit: LIKE_LIMITS[user.tier_id] || 3,
            });
        }

        const viewerTrust = ni(user.trust_score);
        if (viewerTrust !== null && viewerTrust <= TRUST_ELIMINATION_THRESHOLD) {
            const likesToday = await getLikesToday(userId);
            const tierLimit  = LIKE_LIMITS[user.tier_id] || 3;
            const likesLeft  = Math.max(0, tierLimit - likesToday);
            return res.json({
                user_id:       userId,
                total_matches: 0,
                likes_today:   likesToday,
                likes_left:    likesLeft,
                tier_limit:    tierLimit,
                matches:       [],
            });
        }

        const swipedResult = await pool.query(
            `SELECT swiped_user_id FROM swipes
             WHERE swipe_user_id = $1
               AND swipe_type IN ('like', 'dislike', 'superlike')`,
            [userId]
        );
        const swipedIds = new Set(
            swipedResult.rows.map((r) => Number(r.swiped_user_id)).filter((id) => !Number.isNaN(id))
        );

        const allCandidates = await getCandidates(userId);
        const candidates = allCandidates.filter((c) => !swipedIds.has(Number(c.user_id)));
        const { matches, candidateByUserId } = await generateMatches(user, candidates, shouldRank);

        const likesToday = await getLikesToday(userId);
        const tierLimit  = LIKE_LIMITS[user.tier_id] || 3;
        const likesLeft  = Math.max(0, tierLimit - likesToday);

        const fullMatches = (await Promise.all(matches.map(async (match) => {
            const mid = Number(match.user_id);
            const c = candidateByUserId.get(String(mid));
            if (!c) return null;

            const avatarUrl = `https://ui-avatars.com/api/?background=c94b5b&color=fff&size=300&name=${encodeURIComponent((c.first_name || "") + "+" + (c.last_name || ""))}`;

            const fallback = publicTrustUi(c);
            let td;
            try {
                td = await getTrustDisplayForUser(mid);
            } catch {
                td = null;
            }

            const trust_label = td?.label ?? fallback.trust_label;
            let shield_rating = td?.shield_count ?? fallback.shield_rating;
            const trust_dates_reviewed = td?.dates_reviewed ?? fallback.trust_dates_reviewed;
            const public_trust_rating =
                td?.show_numeric && td.public_trust_rating != null
                    ? td.public_trust_rating
                    : fallback.public_trust_rating;

            if (
                (shield_rating == null || shield_rating === "")
                && trust_label
                && trust_label !== "New User"
                && public_trust_rating != null
                && Number.isFinite(Number(public_trust_rating))
            ) {
                const r = Number(public_trust_rating);
                shield_rating = Math.max(1, Math.min(5, Math.round(r)));
            }

            const trust_shield_display = computeTrustShieldDisplay(td, fallback, c);
            const normalizedTrustLabel =
                trust_shield_display != null && trust_label === "New User"
                    ? ""
                    : trust_label;

            const distMi = milesBetween(user.latitude, user.longitude, c.latitude, c.longitude);
            const proximityBits = [];
            if (distMi != null && Number.isFinite(distMi)) {
                if (distMi <= 5) proximityBits.push(`Very close — ${Math.round(distMi)} mi away`);
                else if (distMi <= 20) proximityBits.push(`Nearby — ${Math.round(distMi)} mi away`);
                else if (distMi <= 75) proximityBits.push(`Regional — ${Math.round(distMi)} mi away`);
            }
            const scoreReasons = Array.isArray(match.breakdown?.reasons)
                ? match.breakdown.reasons
                : [];
            let match_reasons = [...proximityBits, ...scoreReasons];
            if (match_reasons.length === 0) {
                const bd = match.breakdown || {};
                const dims = [
                    { key: "values", text: "Values compatibility stands out" },
                    { key: "interests", text: "Interests compatibility stands out" },
                    { key: "lifestyle", text: "Lifestyle compatibility stands out" },
                    { key: "personality", text: "Personality compatibility stands out" },
                ];
                dims.sort((a, b) => (bd[b.key] ?? 0) - (bd[a.key] ?? 0));
                const top = dims[0];
                if (top && (bd[top.key] ?? 0) > 0) match_reasons = [top.text];
            }
            match_reasons = match_reasons.slice(0, 8);

            return {
                user_id:              c.user_id,
                name:                 `${c.first_name} ${c.last_name}`.trim(),
                first_name:           c.first_name           || null,
                last_name:            c.last_name            || null,
                age:                  getAge(c.date_of_birth),
                gender:               c.gender_name          || null,
                height:               inchesToDisplay(c.height_inches),
                location:             c.location_city
                    ? `${c.location_city}${c.location_state ? ", " + c.location_state : ""}`.trim()
                    : null,
                location_city:        c.location_city        || null,
                location_state:       c.location_state       || null,
                bio:                  c.bio                  || null,
                image:                c.profile_photo_url    || avatarUrl,
                starRating:           shield_rating,
                shield_rating,
                trust_shield_display,
                trust_label: normalizedTrustLabel,
                trust_dates_reviewed,
                public_trust_rating,
                safety_based_rating:  true,
                religion_name:        c.religion_name        || null,
                activity_name:        c.activity_name        || null,
                children_name:        c.children_name        || null,
                political_name:       c.political_name       || null,
                dating_goals_name:    c.dating_goals_name    || null,
                smoking_name:         c.smoking_name         || null,
                drinking_name:        c.drinking_name        || null,
                diet_name:            c.diet_name            || null,
                music_name:           c.music_name           || null,
                family_oriented_name: c.family_oriented_name || null,
                personality_name:     c.personality_type_name|| null,
                education_name:       c.education_career_name|| null,
                ethnicity_name:       c.ethnicity_name         || null,
                coffee_name:          c.coffee_name            || null,
                isgamer_name:         c.isgamer_name           || null,
                isreader_name:        c.isreader_name          || null,
                travel_interest_name: c.travel_interest_name   || null,
                pet_interest_name:    c.pet_interest_name      || null,
                score_music_id:            c.music               ?? null,
                score_travel_id:           c.travel              ?? null,
                score_pet_interest_id:     c.pet_interest        ?? null,
                score_reader_id:           c.reader              ?? null,
                score_gamer_id:            c.gamer               ?? null,
                score_activity_level_id:   c.activity_level      ?? null,
                score_drinking_id:         c.drinking_id         ?? null,
                score_smoking_id:          c.smoking_id          ?? null,
                score_coffee_id:           c.coffee_id           ?? null,
                score_diet_id:             c.diet_id             ?? null,
                score_personality_type_id: c.personality_type    ?? null,
                score_political_id:        c.political           ?? null,
                score_dating_goals_id:     c.dating_goals        ?? null,
                score_children_id:         c.children            ?? null,
                score_religion_id:         c.religion_id         ?? null,
                score_family_oriented_id:  c.family_oriented     ?? null,
                score_education_career_id: c.education_career_id ?? null,
                score:                match.score,
                raw_score:            match.raw_score,
                breakdown:            match.breakdown,
                match_reasons,
                distance_miles:       distMi != null && Number.isFinite(distMi)
                    ? Math.round(distMi * 10) / 10
                    : null,
            };
        })))
            .filter(Boolean);

        res.json({
            user_id:       userId,
            total_matches: fullMatches.length,
            likes_today:   likesToday,
            likes_left:    likesLeft,
            tier_limit:    tierLimit,
            matches:       fullMatches,
        });
    } catch (err) {
        console.error("getMatches error:", err.message);
        res.status(500).json({ error: "Failed to generate matches" });
    }
};

exports.rejectUser = async (req, res) => {
    try {
        const userId = authedUserId(req);
        const rejectedUserId = parseInt(req.body.rejected_user_id, 10);

        if (userId == null) return res.status(401).json({ error: "Unauthorized" });
        if (Number.isNaN(rejectedUserId)) return res.status(400).json({ error: "Invalid user ID" });
        if (userId === rejectedUserId)
            return res.status(400).json({ error: "You cannot pass on yourself" });

        const dup = await pool.query(
            `SELECT swipe_id FROM swipes
             WHERE swipe_user_id = $1 AND swiped_user_id = $2 AND swipe_type = 'dislike'`,
            [userId, rejectedUserId]
        );
        if (dup.rows.length > 0) {
            return res.json({ message: "Already passed.", rejected_user_id: rejectedUserId });
        }

        await pool.query(
            `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
             VALUES ($1, $2, 'dislike', NOW())`,
            [userId, rejectedUserId]
        );

        res.status(201).json({ message: "Pass recorded.", rejected_user_id: rejectedUserId });
    } catch (err) {
        console.error("rejectUser error:", err.message);
        res.status(500).json({ error: "Failed to record pass" });
    }
};

exports.likeUser = async (req, res) => {
    try {
        const userId      = authedUserId(req);
        const likedUserId = parseInt(req.body.liked_user_id, 10);

        if (userId == null) return res.status(401).json({ error: "Unauthorized" });
        if (isNaN(likedUserId)) return res.status(400).json({ error: "Invalid user ID" });
        if (userId === likedUserId)
            return res.status(400).json({ error: "You cannot like yourself" });

        const userResult = await pool.query(
            `SELECT tier_id, COALESCE(premium_suspended, false) AS premium_suspended
             FROM users WHERE user_id = $1`,
            [userId]
        );
        if (userResult.rows.length === 0)
            return res.status(404).json({ error: "User not found" });

        let tierId = userResult.rows[0].tier_id || 1;
        if (userResult.rows[0].premium_suspended) tierId = 1;
        const tierLimit  = LIKE_LIMITS[tierId] || 3;
        const likesToday = await getLikesToday(userId);

        if (likesToday >= tierLimit) {
            const payload = {
                error: "Daily like limit reached.",
                likes_used: likesToday,
                tier_limit: tierLimit,
                resets_in: "24 hours",
            };
            if (tierId === 1) payload.upgrade_hint = "aura_plus";
            return res.status(429).json(payload);
        }

        const existing = await pool.query(
            `SELECT swipe_id FROM swipes
             WHERE swipe_user_id = $1 AND swiped_user_id = $2 AND swipe_type = 'like'`,
            [userId, likedUserId]
        );
        if (existing.rows.length > 0)
            return res.status(409).json({ error: "Already liked this user" });

        await pool.query(
            `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
             VALUES ($1, $2, 'like', NOW())`,
            [userId, likedUserId]
        );

        const mutualLike = await pool.query(
            `SELECT swipe_id FROM swipes
             WHERE swipe_user_id = $1 AND swiped_user_id = $2 AND swipe_type = 'like'`,
            [likedUserId, userId]
        );

        let matchCreated = false;
        let matchId = null;
        if (mutualLike.rows.length > 0) {
            const user1 = Math.min(userId, likedUserId);
            const user2 = Math.max(userId, likedUserId);
            await pool.query(
                `INSERT INTO matches (user1_id, user2_id, match_status, matched_at)
                 VALUES ($1, $2, 'active', NOW())
                 ON CONFLICT (user1_id, user2_id) DO NOTHING`,
                [user1, user2]
            );
            matchCreated = true;
            const mid = await pool.query(
                `SELECT match_id FROM matches WHERE user1_id = $1 AND user2_id = $2 LIMIT 1`,
                [user1, user2]
            );
            matchId = mid.rows[0]?.match_id ?? null;

            const actorResult = await pool.query(
                `SELECT first_name, last_name FROM users WHERE user_id = $1`,
                [userId]
            );
            const actorName = actorResult.rows.length > 0
                ? `${actorResult.rows[0].first_name || ""} ${actorResult.rows[0].last_name || ""}`.trim()
                : "Someone";

            await pool.query(
                `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
                 VALUES ($1, 'match_created', $2, false, NOW())`,
                [
                    likedUserId,
                    JSON.stringify({
                        match_id: matchId,
                        matcher_user_id: userId,
                        matcher_name: actorName,
                    }),
                ]
            );
        }

        res.status(201).json({
            message:       matchCreated ? "It's a match!" : "Like recorded.",
            match_created: matchCreated,
            match_id:      matchId,
            likes_used:    likesToday + 1,
            likes_left:    Math.max(0, tierLimit - likesToday - 1),
            tier_limit:    tierLimit,
        });
    } catch (err) {
        console.error("likeUser error:", err.message);
        res.status(500).json({ error: "Failed to record like" });
    }
};

exports.getMutualMatches = async (req, res) => {
    try {
        const userId = authedUserId(req);
        if (userId == null) return res.status(401).json({ error: "Unauthorized" });

        const result = await pool.query(
            `SELECT
                m.match_id,
                m.matched_at,
                CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END AS other_user_id,
                CASE WHEN m.user1_id = $1 THEN u2.first_name ELSE u1.first_name END AS first_name,
                CASE WHEN m.user1_id = $1 THEN u2.last_name  ELSE u1.last_name  END AS last_name,
                CASE WHEN m.user1_id = $1 THEN u2.profile_photo_url ELSE u1.profile_photo_url END AS profile_photo_url,
                (SELECT content FROM message WHERE match_id = m.match_id ORDER BY sent_at DESC LIMIT 1) AS last_message,
                (SELECT sent_at  FROM message WHERE match_id = m.match_id ORDER BY sent_at DESC LIMIT 1) AS last_message_at,
                (SELECT COUNT(*) FROM message WHERE match_id = m.match_id AND sender_id != $1 AND read_at IS NULL) AS unread_count
            FROM matches m
            JOIN users u1 ON u1.user_id = m.user1_id
            JOIN users u2 ON u2.user_id = m.user2_id
            JOIN swipes s1 ON s1.swipe_user_id = m.user1_id AND s1.swiped_user_id = m.user2_id AND s1.swipe_type = 'like'
            JOIN swipes s2 ON s2.swipe_user_id = m.user2_id AND s2.swiped_user_id = m.user1_id AND s2.swipe_type = 'like'
            WHERE (m.user1_id = $1 OR m.user2_id = $1)
              AND m.match_status = 'active'
            ORDER BY last_message_at DESC NULLS LAST`,
            [userId]
        );

        const matches = result.rows.map(row => ({
            match_id:        row.match_id,
            user_id:         row.other_user_id,
            name:            `${row.first_name} ${row.last_name}`.trim(),
            image:           row.profile_photo_url ||
                `https://ui-avatars.com/api/?background=c94b5b&color=fff&size=300&name=${encodeURIComponent(row.first_name + "+" + row.last_name)}`,
            last_message:    row.last_message    || "",
            last_message_at: row.last_message_at || null,
            unread_count:    parseInt(row.unread_count),
            matched_at:      row.matched_at,
        }));

        res.json({ matches });
    } catch (err) {
        console.error("getMutualMatches error:", err.message);
        res.status(500).json({ error: "Failed to fetch mutual matches." });
    }
};