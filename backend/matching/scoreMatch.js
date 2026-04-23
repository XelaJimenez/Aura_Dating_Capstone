const AMBIVERT_ID = 3;

function clamp01(x) {
    if (x === null || x === undefined) return 0;
    return Math.max(0, Math.min(1, x));
}

function eq(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return null;
    return a === b ? 1 : 0;
}

function ordinal3(a, b) {
    if (!a || !b) return null;
    const diff = Math.abs(a - b);
    if (diff === 0) return 1;
    if (diff === 1) return 0.5;
    return 0;
}

function personalityCompat(a, b) {
    if (!a || !b) return null;
    if (a === AMBIVERT_ID || b === AMBIVERT_ID) return 0.8;
    if (a === b) return 1;
    return 0.4;
}

function avg(parts) {
    const nums = parts.filter((p) => p !== null);
    if (nums.length === 0) return 0;
    return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function scoreInterests(userA, userB) {
    const music = eq(userA.music, userB.music);
    const travel = ordinal3(userA.travel, userB.travel);
    const pets = eq(userA.pet_interest, userB.pet_interest);
    const reader = eq(userA.reader, userB.reader);
    const gamer = eq(userA.gamer, userB.gamer);
    return clamp01(avg([music, travel, pets, reader, gamer]));
}

function scoreLifestyle(userA, userB) {
    const activity = ordinal3(userA.activity_level, userB.activity_level);
    const drinking = ordinal3(userA.drinking_id, userB.drinking_id);
    const smoking = ordinal3(userA.smoking_id, userB.smoking_id);
    const diet = eq(userA.diet_id, userB.diet_id);
    const coffee = eq(userA.coffee_id, userB.coffee_id);
    return clamp01(avg([activity, drinking, smoking, diet, coffee]));
}

function scorePersonality(userA, userB) {
    return clamp01(personalityCompat(userA.personality_type, userB.personality_type));
}

function scoreValuesAndRelationship(userA, userB) {
    const religion = eq(userA.religion_id, userB.religion_id);
    const familyOriented = eq(userA.family_oriented, userB.family_oriented);
    const political = ordinal3(userA.political, userB.political);
    const datingGoals = eq(userA.dating_goals, userB.dating_goals);
    const children = eq(userA.children, userB.children);
    const education = eq(userA.education_career_id, userB.education_career_id);
    return clamp01(avg([religion, familyOriented, political, datingGoals, children, education]));
}

function buildCompatibilityReasons(userA, userB) {
    const out = [];
    const push = (s) => {
        if (s && !out.includes(s)) out.push(s);
    };

    if (eq(userA.religion_id, userB.religion_id) === 1) push("Shared faith");
    if (eq(userA.dating_goals, userB.dating_goals) === 1) push("Same dating goals");
    if (eq(userA.children, userB.children) === 1) push("Aligned on kids");

    const pol = ordinal3(userA.political, userB.political);
    if (pol === 1) push("Political views line up");
    else if (pol === 0.5) push("Close on politics");

    if (eq(userA.family_oriented, userB.family_oriented) === 1) push("Same family mindset");
    if (eq(userA.education_career_id, userB.education_career_id) === 1) push("Similar education path");

    if (eq(userA.music, userB.music) === 1) push("Same music taste");

    const tr = ordinal3(userA.travel, userB.travel);
    if (tr === 1) push("Same travel energy");
    else if (tr === 0.5) push("Similar travel style");

    if (eq(userA.pet_interest, userB.pet_interest) === 1) push("Pet vibes in sync");
    if (eq(userA.reader, userB.reader) === 1) push("Both into reading");
    if (eq(userA.gamer, userB.gamer) === 1) push("Both into gaming");

    const act = ordinal3(userA.activity_level, userB.activity_level);
    if (act === 1) push("Similar activity level");
    else if (act === 0.5) push("Close on activity level");

    const drink = ordinal3(userA.drinking_id, userB.drinking_id);
    if (drink === 1) push("Same drinking style");
    else if (drink === 0.5) push("Close on drinking");

    const smoke = ordinal3(userA.smoking_id, userB.smoking_id);
    if (smoke === 1) push("Same take on smoking");
    else if (smoke === 0.5) push("Close on smoking");

    if (eq(userA.diet_id, userB.diet_id) === 1) push("Same diet");
    if (eq(userA.coffee_id, userB.coffee_id) === 1) push("Coffee habits match");

    const p = personalityCompat(userA.personality_type, userB.personality_type);
    if (p >= 0.99) push("Same personality type");
    else if (p >= 0.75) push("Personality vibe fits");

    return out;
}

module.exports = function scoreMatch(userA, userB) {
    const interests = scoreInterests(userA, userB);
    const lifestyle = scoreLifestyle(userA, userB);
    const personality = scorePersonality(userA, userB);
    const values = scoreValuesAndRelationship(userA, userB);

    const weights = { interests: 0.25, lifestyle: 0.25, personality: 0.2, values: 0.3 };
    const totalScore01 =
        interests * weights.interests +
        lifestyle * weights.lifestyle +
        personality * weights.personality +
        values * weights.values;

    const totalScore = Math.round(clamp01(totalScore01) * 100);
    const reasons = buildCompatibilityReasons(userA, userB);

    return {
        totalScore,
        breakdown: {
            interests: Math.round(interests * 100),
            lifestyle: Math.round(lifestyle * 100),
            personality: Math.round(personality * 100),
            values: Math.round(values * 100),
            weights,
            reasons,
        }
    };
};