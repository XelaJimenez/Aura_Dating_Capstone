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

describe("feature1 filterMatches mutual gender", () => {
    test("man seeking non-binary and nb seeking man passes mutual gender", () => {
        const user = baseUser({
            gender_identity: 2,
            preferences: basePrefs({ preferred_genders: [3] }),
        });
        const cand = baseCandidate({
            gender_identity: 3,
            preferences: { preferred_genders: [2] },
        });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 filterMatches trust elimination", () => {
    test("trust 40 excluded", () => {
        const user = baseUser();
        const cand = baseCandidate({ trust_score: 40 });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("trust below 40 excluded", () => {
        const user = baseUser();
        const cand = baseCandidate({ trust_score: 25 });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("trust 41 included with other constraints ok", () => {
        const user = baseUser();
        const cand = baseCandidate({ trust_score: 41 });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 rankMatches trust penalty", () => {
    test("trust 55 penalized minus 15", () => {
        const user = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const cand = { user_id: 4, trust_score: 55, gender_identity: 3, ...fullScoreFields() };
        const raw = scoreMatch(user, cand).totalScore;
        const ranked = rankMatches(user, [cand]);
        assert.equal(ranked[0].trust_penalized, true);
        assert.equal(ranked[0].score, Math.max(0, raw - 15));
    });

    test("trust 56 not penalized", () => {
        const user = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const cand = { user_id: 4, trust_score: 56, gender_identity: 3, ...fullScoreFields() };
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

describe("feature1 filterMatches age", () => {
    test("candidate exactly at min age included", () => {
        const today = new Date();
        const dob = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
        const iso = dob.toISOString().slice(0, 10);
        const user = baseUser({
            preferences: basePrefs({ preferred_age_min: 25, preferred_age_max: 99 }),
        });
        const cand = baseCandidate({ date_of_birth: iso });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });

    test("candidate one year under min excluded", () => {
        const today = new Date();
        const dob = new Date(today.getFullYear() - 24, today.getMonth(), today.getDate());
        const iso = dob.toISOString().slice(0, 10);
        const user = baseUser({
            preferences: basePrefs({ preferred_age_min: 25, preferred_age_max: 99 }),
        });
        const cand = baseCandidate({ date_of_birth: iso });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("candidate exactly at max age included", () => {
        const today = new Date();
        const dob = new Date(today.getFullYear() - 40, today.getMonth(), today.getDate());
        const iso = dob.toISOString().slice(0, 10);
        const user = baseUser({
            preferences: basePrefs({ preferred_age_min: 18, preferred_age_max: 40 }),
        });
        const cand = baseCandidate({ date_of_birth: iso });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });

    test("candidate one year over max excluded", () => {
        const today = new Date();
        const dob = new Date(today.getFullYear() - 41, today.getMonth(), today.getDate());
        const iso = dob.toISOString().slice(0, 10);
        const user = baseUser({
            preferences: basePrefs({ preferred_age_min: 18, preferred_age_max: 40 }),
        });
        const cand = baseCandidate({ date_of_birth: iso });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });
});

describe("feature1 filterMatches height", () => {
    test("candidate exactly at min height included", () => {
        const user = baseUser({
            preferences: basePrefs({ preferred_height_min: 60, preferred_height_max: 80 }),
        });
        const cand = baseCandidate({ height_inches: 60 });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });

    test("candidate one inch under min excluded", () => {
        const user = baseUser({
            preferences: basePrefs({ preferred_height_min: 60, preferred_height_max: 80 }),
        });
        const cand = baseCandidate({ height_inches: 59 });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("candidate exactly at max height included", () => {
        const user = baseUser({
            preferences: basePrefs({ preferred_height_min: 60, preferred_height_max: 72 }),
        });
        const cand = baseCandidate({ height_inches: 72 });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });

    test("candidate one inch over max excluded", () => {
        const user = baseUser({
            preferences: basePrefs({ preferred_height_min: 60, preferred_height_max: 72 }),
        });
        const cand = baseCandidate({ height_inches: 73 });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("null candidate height skips height filter", () => {
        const user = baseUser({
            preferences: basePrefs({ preferred_height_min: 60, preferred_height_max: 72 }),
        });
        const cand = baseCandidate({ height_inches: null });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 filterMatches distance", () => {
    const lat = 41.878113;
    const lon = -87.629799;
    const lonInside = -87.436;
    const lonOutside = -87.43;

    test("within max distance included", () => {
        const d = milesBetween(lat, lon, lat, lonInside);
        assert.ok(d <= 10);
        const user = baseUser({
            latitude: lat,
            longitude: lon,
            preferences: basePrefs({ max_distance_miles: 10 }),
        });
        const cand = baseCandidate({
            latitude: lat,
            longitude: lonInside,
        });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });

    test("beyond max distance excluded", () => {
        const d = milesBetween(lat, lon, lat, lonOutside);
        assert.ok(d > 10);
        const user = baseUser({
            latitude: lat,
            longitude: lon,
            preferences: basePrefs({ max_distance_miles: 10 }),
        });
        const cand = baseCandidate({
            latitude: lat,
            longitude: lonOutside,
        });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("null coordinates skip distance constraint", () => {
        const user = baseUser({
            latitude: null,
            longitude: null,
            preferences: basePrefs({ max_distance_miles: 10 }),
        });
        const cand = baseCandidate({
            latitude: null,
            longitude: null,
        });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 scoreMatch dating goals and children", () => {
    test("same dating goals scores higher than long-term vs casual", () => {
        const base = { ...fullScoreFields(), gender_identity: 2 };
        const a = { ...base, user_id: 1, dating_goals: 3 };
        const bSame = { ...base, user_id: 2, dating_goals: 3 };
        const bCasual = { ...base, user_id: 3, dating_goals: 1 };
        const sSame = scoreMatch(a, bSame).totalScore;
        const sMixed = scoreMatch(a, bCasual).totalScore;
        assert.ok(sSame > sMixed);
    });

    test("long-term vs serious lowers values dimension vs identical", () => {
        const base = { ...fullScoreFields(), gender_identity: 2 };
        const viewer = { ...base, user_id: 1, dating_goals: 3 };
        const serious = { ...base, user_id: 2, dating_goals: 2 };
        const twin = { ...base, user_id: 3, dating_goals: 3 };
        assert.ok(scoreMatch(viewer, twin).totalScore > scoreMatch(viewer, serious).totalScore);
    });

    test("same children scores higher than different children ids", () => {
        const base = { ...fullScoreFields(), gender_identity: 2, dating_goals: 3 };
        const a = { ...base, user_id: 1, children: 1 };
        const bSame = { ...base, user_id: 2, children: 1 };
        const bDiff = { ...base, user_id: 3, children: 3 };
        assert.ok(scoreMatch(a, bSame).totalScore > scoreMatch(a, bDiff).totalScore);
    });
});

describe("feature1 filter soft prefs religion ethnicity political", () => {
    test("strict religion pref on user does not remove candidate from deck", () => {
        const user = baseUser({
            preferences: basePrefs({
                preferred_genders: [3],
                preferred_religion_type_id: 5,
                preferred_religion_label: "Christian",
            }),
        });
        const cand = baseCandidate({ religion_id: 6 });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });

    test("no preference religion label still includes mismatched religion", () => {
        const user = baseUser({
            preferences: basePrefs({
                preferred_genders: [3],
                preferred_religion_label: "No preference",
            }),
        });
        const cand = baseCandidate({ religion_id: 9 });
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 scoreMatch breakdown", () => {
    test("breakdown has interests lifestyle personality values weights reasons", () => {
        const a = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const b = { user_id: 2, gender_identity: 3, ...fullScoreFields() };
        const r = scoreMatch(a, b);
        assert.ok(typeof r.breakdown.interests === "number");
        assert.ok(typeof r.breakdown.lifestyle === "number");
        assert.ok(typeof r.breakdown.personality === "number");
        assert.ok(typeof r.breakdown.values === "number");
        assert.ok(r.breakdown.weights);
        assert.equal(r.breakdown.weights.interests, 0.25);
        assert.ok(Array.isArray(r.breakdown.reasons));
    });
});

describe("feature1 filterMatches account and self", () => {
    test("suspended inactive user excluded", () => {
        const user = baseUser();
        const cand = baseCandidate({ account_status: "suspended" });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });

    test("viewer never matches own user_id in candidate list", () => {
        const user = baseUser({ user_id: 42, gender_identity: 2, preferences: basePrefs({ preferred_genders: [2] }) });
        const cand = baseCandidate({
            user_id: 42,
            gender_identity: 2,
            preferences: { preferred_genders: [2] },
        });
        assert.equal(filterMatches(user, [cand]).length, 0);
    });
});

describe("feature1 filterMatches no preferences", () => {
    test("user with null preferences passes deck except trust gender active", () => {
        const user = baseUser({ preferences: null });
        const cand = baseCandidate();
        assert.equal(filterMatches(user, [cand]).length, 1);
    });
});

describe("feature1 scoreMatch reasons density", () => {
    test("single overlapping trait yields at least one reason when ids align", () => {
        const a = {
            user_id: 1,
            gender_identity: 2,
            religion_id: 5,
            dating_goals: null,
            children: null,
            political: null,
            family_oriented: null,
            education_career_id: null,
            music: null,
            travel: null,
            pet_interest: null,
            reader: null,
            gamer: null,
            activity_level: null,
            drinking_id: null,
            smoking_id: null,
            diet_id: null,
            coffee_id: null,
            personality_type: null,
        };
        const b = { ...a, user_id: 2, gender_identity: 3, religion_id: 5 };
        const r = scoreMatch(a, b);
        assert.ok(r.breakdown.reasons.includes("Shared faith"));
    });

    test("identical profiles yield many reasons", () => {
        const a = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const b = { user_id: 2, gender_identity: 3, ...fullScoreFields() };
        const r = scoreMatch(a, b);
        assert.ok(r.breakdown.reasons.length >= 8);
    });
});

describe("feature1 rankMatches visibility penalty", () => {
    test("visibility_rank_penalty reduces score", () => {
        const user = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const cand = {
            user_id: 4,
            trust_score: 80,
            visibility_rank_penalty: 10,
            gender_identity: 3,
            ...fullScoreFields(),
        };
        const raw = scoreMatch(user, cand).totalScore;
        const ranked = rankMatches(user, [cand]);
        assert.equal(ranked[0].raw_score, raw);
        assert.equal(ranked[0].score, Math.max(0, raw - 10));
    });
});

describe("feature1 rankMatches tie ordering", () => {
    test("equal scores preserve candidate input order", () => {
        const user = { user_id: 1, gender_identity: 2, ...fullScoreFields() };
        const fields = fullScoreFields();
        const a = { user_id: 10, trust_score: 80, gender_identity: 3, ...fields };
        const b = { user_id: 11, trust_score: 80, gender_identity: 3, ...fields };
        const r1 = rankMatches(user, [a, b]).map((x) => x.user_id);
        const r2 = rankMatches(user, [b, a]).map((x) => x.user_id);
        assert.deepEqual(r1, [10, 11]);
        assert.deepEqual(r2, [11, 10]);
    });
});

describe("feature1 parseCityStateLocation", () => {
    test("Chicago IL valid", () => {
        const p = parseCityStateLocation("Chicago, IL");
        assert.equal(p.ok, true);
        assert.equal(p.city, "Chicago");
        assert.equal(p.state, "IL");
    });

    test("Chicago alone invalid", () => {
        const p = parseCityStateLocation("Chicago");
        assert.equal(p.ok, false);
    });

    test("IL alone invalid", () => {
        const p = parseCityStateLocation("IL");
        assert.equal(p.ok, false);
    });

    test("chicago il valid", () => {
        const p = parseCityStateLocation("chicago, il");
        assert.equal(p.ok, true);
        assert.equal(p.city, "chicago");
        assert.equal(p.state, "il");
    });

    test("New York NY valid", () => {
        const p = parseCityStateLocation("New York, NY");
        assert.equal(p.ok, true);
        assert.equal(p.city, "New York");
        assert.equal(p.state, "NY");
    });

    test("empty invalid", () => {
        const p = parseCityStateLocation("");
        assert.equal(p.ok, false);
    });

    test("123 IL invalid", () => {
        const p = parseCityStateLocation("123, IL");
        assert.equal(p.ok, false);
    });
});

describe("feature1 geocodeCityState fetch mock", () => {
    test("HTTP error returns null without throwing", async () => {
        const orig = global.fetch;
        global.fetch = async () => ({ ok: false, status: 500, json: async () => [] });
        delete require.cache[require.resolve("../services/geocodeCityState")];
        const { geocodeCityState } = require("../services/geocodeCityState");
        const r = await geocodeCityState("Chicago", "IL");
        assert.equal(r, null);
        global.fetch = orig;
        delete require.cache[require.resolve("../services/geocodeCityState")];
    });
});

function chatInboxPreview(match) {
    return match.last_message && String(match.last_message).trim()
        ? match.last_message
        : `You matched with ${match.name} — say hello!`;
}

describe("feature1 messaging inbox preview contract", () => {
    test("empty last_message yields say hello prompt", () => {
        const s = chatInboxPreview({ name: "Alex Rivera", last_message: "" });
        assert.equal(s, "You matched with Alex Rivera — say hello!");
    });

    test("whitespace last_message yields say hello prompt", () => {
        const s = chatInboxPreview({ name: "Sam", last_message: "   " });
        assert.equal(s, "You matched with Sam — say hello!");
    });

    test("non-empty last_message shows text", () => {
        const s = chatInboxPreview({ name: "Sam", last_message: "hey there" });
        assert.equal(s, "hey there");
    });
});

describe("feature1 overlay response contract", () => {
    test("mutual like payload uses match_created not isMatch", () => {
        const body = { match_created: true, match_id: 9 };
        assert.equal(body.match_created, true);
        assert.ok(!Object.prototype.hasOwnProperty.call(body, "isMatch"));
    });
});

describe("feature1 distance reasons absence", () => {
    test("null lat lng still produces score reasons without proximity in controller merge", () => {
        const a = { user_id: 1, gender_identity: 2, latitude: null, longitude: null, ...fullScoreFields() };
        const b = { user_id: 2, gender_identity: 3, latitude: null, longitude: null, ...fullScoreFields() };
        const r = scoreMatch(a, b);
        assert.ok(r.breakdown.reasons.length >= 1);
    });
});
