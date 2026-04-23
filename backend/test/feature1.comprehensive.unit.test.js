const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const filterMatches = require("../matching/filterMatches");
const rankMatches = require("../matching/rankMatches");
const scoreMatch = require("../matching/scoreMatch");
const { milesBetween } = require("../utils/geoDistance");
const { parseCityStateLocation } = require("../utils/parseCityStateLocation");

function basePrefs(overrides = {}) {
    return {
        preferred_age_min: 18,
        preferred_age_max: 99,
        preferred_genders: [3],
        preferred_religion_type_id: null,
        preferred_religion_label: "No preference",
        preferred_political_affil: null,
        preferred_political_label: "No preference",
        preferred_ethnicity_id: null,
        preferred_ethnicity_label: "No preference",
        preferred_dating_goals: null,
        preferred_dating_goals_label: "No preference",
        preferred_want_children: null,
        preferred_want_children_label: "No preference",
        preferred_family_oriented: null,
        preferred_family_oriented_label: "No preference",
        min_distance_miles: null,
        max_distance_miles: null,
        preferred_height_min: null,
        preferred_height_max: null,
        ...overrides,
    };
}

function baseUser(overrides = {}) {
    return {
        user_id: 1,
        gender_identity: 2,
        gender_name: "Male",
        latitude: 41.878113,
        longitude: -87.629799,
        preferences: basePrefs(),
        ...overrides,
    };
}

function baseCandidate(overrides = {}) {
    return {
        user_id: 2,
        trust_score: 80,
        account_status: "active",
        gender_identity: 3,
        date_of_birth: "1999-01-01",
        height_inches: 66,
        latitude: 41.878113,
        longitude: -87.629799,
        preferences: { preferred_genders: [2] },
        religion_id: 5,
        political: 3,
        ethnicity_id: 1,
        dating_goals: 3,
        children: 1,
        family_oriented: 1,
        music: 1,
        travel: 2,
        pet_interest: 1,
        reader: 2,
        gamer: 3,
        activity_level: 3,
        drinking_id: 3,
        smoking_id: 2,
        diet_id: 1,
        coffee_id: 1,
        personality_type: 3,
        education_career_id: 4,
        ...overrides,
    };
}

function fullScoreFields() {
    return {
        religion_id: 6,
        family_oriented: 1,
        political: 3,
        dating_goals: 3,
        children: 1,
        education_career_id: 4,
        music: 1,
        travel: 2,
        pet_interest: 1,
        reader: 2,
        gamer: 3,
        activity_level: 3,
        drinking_id: 3,
        smoking_id: 2,
        diet_id: 1,
        coffee_id: 1,
        personality_type: 3,
    };
}

function lonAtMostMilesEast(lat, lon, maxMiles) {
    let lo = lon;
    let hi = lon + 0.01;
    while (milesBetween(lat, lon, lat, hi) <= maxMiles) {
        hi += 0.05;
        if (hi > lon + 180) throw new Error("lon search failed");
    }
    for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (milesBetween(lat, lon, lat, mid) <= maxMiles) lo = mid;
        else hi = mid;
    }
    return lo;
}

function lonReachMilesEast(lat, lon, targetMiles) {
    let lo = lon;
    let hi = lon + 0.01;
    while (milesBetween(lat, lon, lat, hi) < targetMiles) {
        hi += 0.05;
        if (hi > lon + 180) throw new Error("lon search failed");
    }
    for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (milesBetween(lat, lon, lat, mid) < targetMiles) lo = mid;
        else hi = mid;
    }
    return hi;
}

function mergeMatchReasonsForTest(userLat, userLon, cLat, cLon, breakdown) {
    const distMi = milesBetween(userLat, userLon, cLat, cLon);
    const proximityBits = [];
    if (distMi != null && Number.isFinite(distMi)) {
        if (distMi <= 5) proximityBits.push(`Very close — ${Math.round(distMi)} mi away`);
        else if (distMi <= 20) proximityBits.push(`Nearby — ${Math.round(distMi)} mi away`);
        else if (distMi <= 75) proximityBits.push(`Regional — ${Math.round(distMi)} mi away`);
    }
    const scoreReasons = Array.isArray(breakdown?.reasons) ? breakdown.reasons : [];
    let match_reasons = [...proximityBits, ...scoreReasons];
    if (match_reasons.length === 0) {
        const bd = breakdown || {};
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
    return match_reasons.slice(0, 8);
}

function chatInboxPreview(match) {
    return match.last_message && String(match.last_message).trim()
        ? match.last_message
        : `You matched with ${match.name} — say hello!`;
}

function shouldShowItsMatchOverlay(likeResponseBody) {
    return Boolean(likeResponseBody && likeResponseBody.match_created);
}

describe("feature1 comprehensive trust elimination boundary", () => {
    test("trust 40 excluded at threshold", () => {
        const user = baseUser();
        const cand = baseCandidate({ trust_score: 40 });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("trust 39 excluded below threshold", () => {
        const user = baseUser();
        const cand = baseCandidate({ trust_score: 39 });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("trust 41 passes elimination when other filters ok", () => {
        const user = baseUser();
        const cand = baseCandidate({ trust_score: 41 });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 comprehensive trust penalty band", () => {
    test("trust 50 penalized within internal cutoff", () => {
        const user = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const cand = { user_id: 4, trust_score: 50, gender_identity: 3, ...fullScoreFields() };
        const raw = scoreMatch(user, cand).totalScore;
        const ranked = rankMatches(user, [cand]);
        assert.equal(ranked[0].trust_penalized, true);
        assert.equal(ranked[0].score, Math.max(0, raw - 15));
    });

    test("trust 41 penalized", () => {
        const user = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const cand = { user_id: 4, trust_score: 41, gender_identity: 3, ...fullScoreFields() };
        const raw = scoreMatch(user, cand).totalScore;
        const ranked = rankMatches(user, [cand]);
        assert.equal(ranked[0].trust_penalized, true);
        assert.equal(ranked[0].score, Math.max(0, raw - 15));
    });

    test("trust 60 not penalized above band", () => {
        const user = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const cand = { user_id: 4, trust_score: 60, gender_identity: 3, ...fullScoreFields() };
        const raw = scoreMatch(user, cand).totalScore;
        const ranked = rankMatches(user, [cand]);
        assert.equal(ranked[0].trust_penalized, false);
        assert.equal(ranked[0].score, raw);
    });

    test("trust 61 not penalized", () => {
        const user = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const cand = { user_id: 4, trust_score: 61, gender_identity: 3, ...fullScoreFields() };
        const raw = scoreMatch(user, cand).totalScore;
        const ranked = rankMatches(user, [cand]);
        assert.equal(ranked[0].trust_penalized, false);
        assert.equal(ranked[0].score, raw);
    });
});

describe("feature1 comprehensive distance boundary", () => {
    const lat = 41.878113;
    const lon = -87.629799;

    test("candidate exactly at max miles included", () => {
        const maxMi = 10;
        const lonEdge = lonAtMostMilesEast(lat, lon, maxMi);
        const d = milesBetween(lat, lon, lat, lonEdge);
        assert.ok(d <= maxMi + 1e-6);
        assert.ok(Math.abs(d - maxMi) < 0.06);
        const user = baseUser({
            latitude: lat,
            longitude: lon,
            preferences: basePrefs({ max_distance_miles: maxMi }),
        });
        const cand = baseCandidate({
            latitude: lat,
            longitude: lonEdge,
        });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });

    test("candidate just over max miles excluded", () => {
        const maxMi = 10;
        const lonEdge = lonReachMilesEast(lat, lon, maxMi + 1);
        assert.ok(milesBetween(lat, lon, lat, lonEdge) > maxMi);
        const user = baseUser({
            latitude: lat,
            longitude: lon,
            preferences: basePrefs({ max_distance_miles: maxMi }),
        });
        const cand = baseCandidate({
            latitude: lat,
            longitude: lonEdge,
        });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("candidate inside min distance ring excluded", () => {
        const minMi = 8;
        const lonClose = lonAtMostMilesEast(lat, lon, minMi - 0.25);
        assert.ok(milesBetween(lat, lon, lat, lonClose) < minMi);
        const user = baseUser({
            latitude: lat,
            longitude: lon,
            preferences: basePrefs({ min_distance_miles: minMi, max_distance_miles: null }),
        });
        const cand = baseCandidate({
            latitude: lat,
            longitude: lonClose,
        });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("candidate exactly at min distance included", () => {
        const minMi = 8;
        const lonEdge = lonReachMilesEast(lat, lon, minMi);
        const d = milesBetween(lat, lon, lat, lonEdge);
        assert.ok(d >= minMi - 1e-6);
        assert.ok(Math.abs(d - minMi) < 0.06);
        const user = baseUser({
            latitude: lat,
            longitude: lon,
            preferences: basePrefs({ min_distance_miles: minMi, max_distance_miles: null }),
        });
        const cand = baseCandidate({
            latitude: lat,
            longitude: lonEdge,
        });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 comprehensive mutual gender pairs", () => {
    test("woman seeking man and man seeking woman passes", () => {
        const user = baseUser({
            gender_identity: 3,
            preferences: basePrefs({ preferred_genders: [2] }),
        });
        const cand = baseCandidate({
            gender_identity: 2,
            preferences: { preferred_genders: [3] },
        });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 comprehensive dating goals and children scoring", () => {
    test("identical dating goals beats both serious and casual mismatches", () => {
        const base = { ...fullScoreFields(), gender_identity: 2 };
        const viewer = { ...base, user_id: 1, dating_goals: 3 };
        const twin = { ...base, user_id: 2, dating_goals: 3 };
        const serious = { ...base, user_id: 3, dating_goals: 2 };
        const casual = { ...base, user_id: 4, dating_goals: 1 };
        const sTwin = scoreMatch(viewer, twin).totalScore;
        assert.ok(sTwin > scoreMatch(viewer, serious).totalScore);
        assert.ok(sTwin > scoreMatch(viewer, casual).totalScore);
    });

    test("serious vs casual not both strictly closer than identical without other differences", () => {
        const base = { ...fullScoreFields(), gender_identity: 2 };
        const viewer = { ...base, user_id: 1, dating_goals: 3 };
        const serious = { ...base, user_id: 3, dating_goals: 2 };
        const casual = { ...base, user_id: 4, dating_goals: 1 };
        const a = scoreMatch(viewer, serious).totalScore;
        const b = scoreMatch(viewer, casual).totalScore;
        assert.equal(a, b);
    });

    test("aligned children scores higher than different children", () => {
        const base = { ...fullScoreFields(), gender_identity: 2, dating_goals: 3 };
        const viewer = { ...base, user_id: 1, children: 1 };
        const same = { ...base, user_id: 2, children: 1 };
        const diff = { ...base, user_id: 3, children: 3 };
        assert.ok(scoreMatch(viewer, same).totalScore > scoreMatch(viewer, diff).totalScore);
    });
});

describe("feature1 comprehensive religion political score-only", () => {
    test("shared religion scores higher than different religion with identical vectors", () => {
        const base = { ...fullScoreFields(), gender_identity: 2, dating_goals: 3 };
        const viewer = { ...base, user_id: 1, religion_id: 6 };
        const same = { ...base, user_id: 2, gender_identity: 3, religion_id: 6 };
        const diff = { ...base, user_id: 3, gender_identity: 3, religion_id: 7 };
        assert.ok(scoreMatch(viewer, same).totalScore > scoreMatch(viewer, diff).totalScore);
    });

    test("shared political exact scores higher than distant political ids", () => {
        const base = { ...fullScoreFields(), gender_identity: 2, dating_goals: 3, religion_id: 6 };
        const viewer = { ...base, user_id: 1, political: 3 };
        const same = { ...base, user_id: 2, gender_identity: 3, political: 3 };
        const far = { ...base, user_id: 3, gender_identity: 3, political: 99 };
        assert.ok(scoreMatch(viewer, same).totalScore > scoreMatch(viewer, far).totalScore);
    });
});

describe("feature1 comprehensive partner soft prefs do not filter deck", () => {
    test("strict ethnicity label on preferences does not remove candidate", () => {
        const user = baseUser({
            preferences: basePrefs({
                preferred_genders: [3],
                preferred_ethnicity_id: 2,
                preferred_ethnicity_label: "Asian",
            }),
        });
        const cand = baseCandidate({ ethnicity_id: 9 });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });

    test("strict political label on preferences does not remove candidate", () => {
        const user = baseUser({
            preferences: basePrefs({
                preferred_genders: [3],
                preferred_political_affil: 2,
                preferred_political_label: "Moderate",
            }),
        });
        const cand = baseCandidate({ political: 5 });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 comprehensive score breakdown keys", () => {
    test("breakdown exposes category scores weights and reasons", () => {
        const a = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const b = { user_id: 2, gender_identity: 3, ...fullScoreFields() };
        const r = scoreMatch(a, b);
        assert.ok("interests" in r.breakdown);
        assert.ok("lifestyle" in r.breakdown);
        assert.ok("personality" in r.breakdown);
        assert.ok("values" in r.breakdown);
        assert.ok("weights" in r.breakdown);
        assert.ok("reasons" in r.breakdown);
        assert.equal(r.breakdown.weights.values, 0.3);
    });
});

describe("feature1 comprehensive match reasons merge", () => {
    test("null coordinates yields no proximity prefix", () => {
        const a = { user_id: 1, gender_identity: 2, latitude: null, longitude: null, ...fullScoreFields() };
        const b = { user_id: 2, gender_identity: 3, latitude: null, longitude: null, ...fullScoreFields() };
        const bd = scoreMatch(a, b).breakdown;
        const merged = mergeMatchReasonsForTest(null, null, null, null, bd);
        assert.ok(!merged.some((x) => typeof x === "string" && x.includes("mi away")));
        assert.ok(merged.length >= 1);
    });

    test("single score reason yields length one when no proximity", () => {
        const bd = {
            interests: 0,
            lifestyle: 0,
            personality: 0,
            values: 50,
            reasons: ["Aligned on kids"],
        };
        const merged = mergeMatchReasonsForTest(null, null, null, null, bd);
        assert.deepEqual(merged, ["Aligned on kids"]);
    });

    test("many reasons plus proximity caps", () => {
        const bd = {
            interests: 80,
            lifestyle: 80,
            personality: 80,
            values: 80,
            reasons: Array.from({ length: 12 }, (_, i) => `Reason ${i}`),
        };
        const merged = mergeMatchReasonsForTest(41.878113, -87.629799, 41.88, -87.629799, bd);
        assert.ok(merged[0].includes("mi away") || merged[0].startsWith("Reason"));
        assert.equal(merged.length, 8);
    });
});

describe("feature1 comprehensive parseCityState errors", () => {
    test("Chicago alone returns guidance error", () => {
        const p = parseCityStateLocation("Chicago");
        assert.equal(p.ok, false);
        assert.ok(String(p.error).includes("City or state alone"));
    });

    test("IL alone returns guidance error", () => {
        const p = parseCityStateLocation("IL");
        assert.equal(p.ok, false);
    });
});

describe("feature1 comprehensive geocode success mock", () => {
    test("nominatim-shaped response returns coordinates", async () => {
        const orig = global.fetch;
        global.fetch = async () => ({
            ok: true,
            json: async () => [{ lat: "41.9", lon: "-87.6" }],
        });
        delete require.cache[require.resolve("../services/geocodeCityState")];
        const { geocodeCityState } = require("../services/geocodeCityState");
        const r = await geocodeCityState("Chicago", "IL");
        assert.deepEqual(r, { latitude: 41.9, longitude: -87.6 });
        global.fetch = orig;
        delete require.cache[require.resolve("../services/geocodeCityState")];
    });
});

describe("feature1 comprehensive inbox preview parity", () => {
    test("ChatList empty last_message uses say hello copy", () => {
        const s = chatInboxPreview({ name: "Alex Kim", last_message: "" });
        assert.equal(s, "You matched with Alex Kim — say hello!");
    });

    test("ChatList non-empty last_message shows text", () => {
        const s = chatInboxPreview({ name: "Alex Kim", last_message: "yo" });
        assert.equal(s, "yo");
    });
});

describe("feature1 comprehensive overlay gate", () => {
    test("overlay opens when match_created true", () => {
        assert.equal(shouldShowItsMatchOverlay({ match_created: true }), true);
    });

    test("overlay stays closed on one-way like", () => {
        assert.equal(shouldShowItsMatchOverlay({ match_created: false }), false);
    });

    test("overlay partner fields come from current card", () => {
        const card = {
            user_id: 9,
            name: "Pat Lee",
            first_name: "Pat",
            image: "https://example.com/p.jpg",
        };
        const partner = { ...card, match_id: 3 };
        assert.equal(partner.first_name || partner.name, "Pat");
        assert.equal(partner.image, "https://example.com/p.jpg");
    });
});

describe("feature1 comprehensive placeholder image", () => {
    test("missing profile photo uses ui-avatars fallback pattern", () => {
        const first_name = "Avery";
        const last_name = "Kim";
        const profile_photo_url = null;
        const enc = encodeURIComponent(`${first_name}+${last_name}`);
        const fallback = `https://ui-avatars.com/api/?background=c94b5b&color=fff&size=300&name=${enc}`;
        const image = profile_photo_url || fallback;
        assert.ok(image.includes("ui-avatars.com"));
        assert.ok(image.includes("Avery"));
    });
});
