const TABLE_SPECS = {
    gender_type: ["gender_type", "gender_type_id", "gender_name"],
    religion_type: ["religion_type", "religion_type_id", "religion_name"],
    ethnicity_type: ["ethnicity_type", "ethnicity_type_id", "ethnicity_name"],
    education_career: ["education_career", "education_career_id", "education_career_name"],
    family_oriented: ["family_oriented", "family_oriented_id", "family_oriented_name"],
    smoking: ["smoking", "smoking_id", "smoking_name"],
    drinking: ["drinking", "drinking_id", "drinking_name"],
    coffee_drinker: ["coffee_drinker", "coffee_id", "coffee_name"],
    diet: ["diet", "diet_id", "diet_name"],
    activity_level: ["activity_level", "activity_level_id", "activity_name"],
    music: ["music", "music_id", "music_name"],
    gamer: ["gamer", "isgamer_id", "isgamer_name"],
    reader: ["reader", "isreader_id", "isreader_name"],
    travel_interest: ["travel_interest", "travel_interest_id", "travel_interest_name"],
    pet_interest: ["pet_interest", "pet_interest_id", "pet_interest_name"],
    personality_type: ["personality_type", "personality_type_id", "personality_type_name"],
    dating_goals: ["dating_goals", "dating_goals_id", "dating_goal_name"],
    astrology_sign: ["astrology_sign", "astrology_sign_id", "astrology_sign"],
    want_children: ["want_children", "want_children_id", "want_children"],
    political_affil: ["political_affil", "political_affil_id", "political_affil"],
};

function normalizeUiLabel(label) {
    if (label == null || label === "") return "";
    return String(label).trim().replace(/\u2018|\u2019/g, "'");
}

const PARTNER_WANT_CHILDREN_UI_TO_DB = {
    "Has kids": "Have kids",
    "Wants kids": "Want kids",
    "No kids": "Don't want kids",
};

async function lookupFk(pool, tableKey, label, options = {}) {
    const { partnerChildrenPref = false } = options;
    const spec = TABLE_SPECS[tableKey];
    if (!spec) return null;
    const [table, idCol, nameCol] = spec;
    if (!label || !String(label).trim()) return null;
    let normalized = normalizeUiLabel(String(label));
    if (tableKey === "want_children" && partnerChildrenPref && PARTNER_WANT_CHILDREN_UI_TO_DB[normalized]) {
        normalized = PARTNER_WANT_CHILDREN_UI_TO_DB[normalized];
    }
    const tries = new Set([normalized]);
    if (tableKey === "gender_type") {
        if (normalized === "Male") tries.add("Man");
        if (normalized === "Female") tries.add("Woman");
    }
    if (tableKey === "education_career") {
        if (normalized === "Trade") tries.add("Trade / Vocational");
    }
    for (const name of tries) {
        if (!name) continue;
        const r = await pool.query(
            `SELECT ${idCol} AS id FROM ${table} WHERE ${nameCol} = $1 LIMIT 1`,
            [name]
        );
        if (r.rows[0] && r.rows[0].id != null) return r.rows[0].id;
    }
    return null;
}

async function resolveProfileUserFieldIds(pool, fields) {
    const {
        gender,
        religion,
        ethnicity,
        education,
        familyOriented,
        smoker,
        drinker,
        coffeeDrinker,
        diet,
        activityLevel,
        musicPref,
        gamer,
        reader,
        travel,
        pets,
        personality,
        datingGoal,
        astrology,
        children,
        politicalStanding,
    } = fields;

    const [
        gender_identity,
        religion_id,
        ethnicity_id,
        education_career_id,
        family_oriented,
        smoking_id,
        drinking_id,
        coffee_id,
        diet_id,
        activity_level,
        music,
        gamer_id,
        reader_id,
        travel_id,
        pet_interest,
        personality_type,
        dating_goals,
        astrology_id,
        children_id,
        political,
    ] = await Promise.all([
        lookupFk(pool, "gender_type", gender),
        lookupFk(pool, "religion_type", religion),
        lookupFk(pool, "ethnicity_type", ethnicity),
        lookupFk(pool, "education_career", education),
        lookupFk(pool, "family_oriented", familyOriented),
        lookupFk(pool, "smoking", smoker),
        lookupFk(pool, "drinking", drinker),
        lookupFk(pool, "coffee_drinker", coffeeDrinker),
        lookupFk(pool, "diet", diet),
        lookupFk(pool, "activity_level", activityLevel),
        lookupFk(pool, "music", musicPref),
        lookupFk(pool, "gamer", gamer),
        lookupFk(pool, "reader", reader),
        lookupFk(pool, "travel_interest", travel),
        lookupFk(pool, "pet_interest", pets),
        lookupFk(pool, "personality_type", personality),
        lookupFk(pool, "dating_goals", datingGoal),
        lookupFk(pool, "astrology_sign", astrology),
        lookupFk(pool, "want_children", children),
        lookupFk(pool, "political_affil", politicalStanding),
    ]);

    return {
        gender_identity,
        religion_id,
        ethnicity_id,
        education_career_id,
        family_oriented,
        smoking_id,
        drinking_id,
        coffee_id,
        diet_id,
        activity_level,
        music,
        gamer_id,
        reader_id,
        travel_id,
        pet_interest,
        personality_type,
        dating_goals,
        astrology_id,
        children_id,
        political,
    };
}

async function resolvePreferenceFieldIds(pool, fields) {
    const {
        religionPref,
        ethnicityPref,
        politicalPref,
        childrenPref,
        datingGoalPref,
        activityPref,
        familyOrientedPref,
    } = fields;

    const [
        preferred_religion_type_id,
        preferred_ethnicity_id,
        preferred_political_affil,
        preferred_want_children,
        preferred_dating_goals,
        preferred_activity_level,
        preferred_family_oriented,
    ] = await Promise.all([
        lookupFk(pool, "religion_type", religionPref),
        lookupFk(pool, "ethnicity_type", ethnicityPref),
        lookupFk(pool, "political_affil", politicalPref),
        lookupFk(pool, "want_children", childrenPref, { partnerChildrenPref: true }),
        lookupFk(pool, "dating_goals", datingGoalPref),
        lookupFk(pool, "activity_level", activityPref),
        lookupFk(pool, "family_oriented", familyOrientedPref),
    ]);

    return {
        preferred_religion_type_id,
        preferred_ethnicity_id,
        preferred_political_affil,
        preferred_want_children,
        preferred_dating_goals,
        preferred_activity_level,
        preferred_family_oriented,
    };
}

module.exports = {
    normalizeUiLabel,
    lookupFk,
    resolveProfileUserFieldIds,
    resolvePreferenceFieldIds,
};
