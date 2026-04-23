const pool = require("../config/db");
const { ni } = require("../utils/pgCoerce");
const { partnerUiLabelsToDbNames, dbGenderNameToPartnerUi } = require("../utils/partnerGenderUi");
const { parseCityStateLocation } = require("../utils/parseCityStateLocation");
const { geocodeCityState } = require("../services/geocodeCityState");
const { resolveProfileUserFieldIds, resolvePreferenceFieldIds } = require("../utils/resolveLookupIdsByName");

exports.saveProfile = async (req, res) => {
    const user_id = req.user?.id;
    if (!user_id) return res.status(400).json({ error: "user_id is required." });

    const {
        name, location, bio, height,
        gender, religion, ethnicity, education, familyOriented,
        smoker, drinker, coffeeDrinker, diet, activityLevel,
        musicPref, gamer, reader, travel, pets,
        personality, datingGoal, astrology, children, politicalStanding,
    } = req.body;

    try {
        let first_name = null, last_name = null;
        if (name && name.trim()) {
            const parts = name.trim().split(" ");
            first_name = parts[0] || null;
            last_name  = parts.slice(1).join(" ") || null;
        }

        let location_city = null;
        let location_state = null;
        if (location && location.trim()) {
            const locParsed = parseCityStateLocation(location);
            if (!locParsed.ok) {
                return res.status(400).json({ error: locParsed.error });
            }
            location_city = locParsed.city;
            location_state = locParsed.state;
        }

        let geoLat = null;
        let geoLng = null;
        if (location_city && location_state) {
            try {
                const geo = await geocodeCityState(location_city, location_state);
                if (geo) {
                    geoLat = geo.latitude;
                    geoLng = geo.longitude;
                }
            } catch {
                geoLat = null;
                geoLng = null;
            }
        }

        const ids = await resolveProfileUserFieldIds(pool, {
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
        });

        await pool.query(
            `UPDATE users SET
                first_name          = COALESCE($1,  first_name),
                last_name           = COALESCE($2,  last_name),
                location_city       = COALESCE($3,  location_city),
                location_state      = COALESCE($4,  location_state),
                bio                 = COALESCE($5,  bio),
                height_inches       = COALESCE($6,  height_inches),
                gender_identity     = COALESCE($7,  gender_identity),
                religion_id         = COALESCE($8,  religion_id),
                ethnicity_id        = COALESCE($9,  ethnicity_id),
                education_career_id = COALESCE($10, education_career_id),
                family_oriented     = COALESCE($11, family_oriented),
                smoking_id          = COALESCE($12, smoking_id),
                drinking_id         = COALESCE($13, drinking_id),
                coffee_id           = COALESCE($14, coffee_id),
                diet_id             = COALESCE($15, diet_id),
                activity_level      = COALESCE($16, activity_level),
                music               = COALESCE($17, music),
                gamer               = COALESCE($18, gamer),
                reader              = COALESCE($19, reader),
                travel              = COALESCE($20, travel),
                pet_interest        = COALESCE($21, pet_interest),
                personality_type    = COALESCE($22, personality_type),
                dating_goals        = COALESCE($23, dating_goals),
                astrology           = COALESCE($24, astrology),
                children            = COALESCE($25, children),
                political           = COALESCE($26, political),
                latitude            = COALESCE($27::decimal, latitude),
                longitude           = COALESCE($28::decimal, longitude)
            WHERE user_id = $29`,
            [
                first_name, last_name, location_city, location_state, bio || null, height || null,
                ids.gender_identity,
                ids.religion_id,
                ids.ethnicity_id,
                ids.education_career_id,
                ids.family_oriented,
                ids.smoking_id,
                ids.drinking_id,
                ids.coffee_id,
                ids.diet_id,
                ids.activity_level,
                ids.music,
                ids.gamer_id,
                ids.reader_id,
                ids.travel_id,
                ids.pet_interest,
                ids.personality_type,
                ids.dating_goals,
                ids.astrology_id,
                ids.children_id,
                ids.political,
                geoLat,
                geoLng,
                user_id
            ]
        );

        res.json({ message: "Profile saved successfully." });
    } catch (err) {
        console.error("saveProfile error:", err.message);
        res.status(500).json({ error: "Failed to save profile." });
    }
};

exports.savePreferences = async (req, res) => {
    const user_id = req.user?.id;
    if (!user_id) return res.status(400).json({ error: "user_id is required." });

    const {
        genderPref, genderPrefs, minAge, maxAge, minHeight, maxHeight,
        religionPref, ethnicityPref, politicalPref, childrenPref, datingGoalPref,
        activityPref, familyOrientedPref,
    } = req.body;

    try {
        const dbPartnerNames = partnerUiLabelsToDbNames(
            Array.isArray(genderPrefs) && genderPrefs.length > 0
                ? genderPrefs
                : genderPref && genderPref !== "No preference" && genderPref !== "Multiple"
                    ? [genderPref]
                    : []
        );

        let preferredGenderTypeIds = [];
        if (dbPartnerNames.length > 0) {
            const gRes = await pool.query(
                `SELECT gender_type_id FROM gender_type WHERE gender_name = ANY($1::text[])`,
                [dbPartnerNames]
            );
            preferredGenderTypeIds = [...new Set(gRes.rows.map((r) => r.gender_type_id))];
        }

        const prefIds = await resolvePreferenceFieldIds(pool, {
            religionPref,
            ethnicityPref,
            politicalPref,
            childrenPref,
            datingGoalPref,
            activityPref,
            familyOrientedPref,
        });

        const prefResult = await pool.query(
            `INSERT INTO preferences
                (user_id, preferred_age_min, preferred_age_max,
                 preferred_height_min, preferred_height_max,
                 preferred_religion_type_id, preferred_ethnicity_id,
                 preferred_political_affil, preferred_want_children,
                 preferred_dating_goals, preferred_activity_level, preferred_family_oriented)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT (user_id) DO UPDATE SET
                preferred_age_min           = EXCLUDED.preferred_age_min,
                preferred_age_max           = EXCLUDED.preferred_age_max,
                preferred_height_min        = EXCLUDED.preferred_height_min,
                preferred_height_max        = EXCLUDED.preferred_height_max,
                preferred_religion_type_id  = EXCLUDED.preferred_religion_type_id,
                preferred_ethnicity_id      = EXCLUDED.preferred_ethnicity_id,
                preferred_political_affil   = EXCLUDED.preferred_political_affil,
                preferred_want_children     = EXCLUDED.preferred_want_children,
                preferred_dating_goals      = EXCLUDED.preferred_dating_goals,
                preferred_activity_level    = EXCLUDED.preferred_activity_level,
                preferred_family_oriented   = EXCLUDED.preferred_family_oriented
             RETURNING preference_id`,
            [
                user_id,
                minAge    || 18,
                maxAge    || 100,
                minHeight || 60,
                maxHeight || 80,
                prefIds.preferred_religion_type_id,
                prefIds.preferred_ethnicity_id,
                prefIds.preferred_political_affil,
                prefIds.preferred_want_children,
                prefIds.preferred_dating_goals,
                prefIds.preferred_activity_level,
                prefIds.preferred_family_oriented,
            ]
        );

        const preference_id = prefResult.rows[0].preference_id;

        const skipGenderRewrite =
            genderPref === "Multiple" &&
            (!Array.isArray(genderPrefs) || genderPrefs.length === 0);

        if (!skipGenderRewrite) {
            await pool.query("DELETE FROM preference_genders WHERE preference_id = $1", [preference_id]);
            for (const gid of preferredGenderTypeIds) {
                await pool.query(
                    "INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    [preference_id, gid]
                );
            }
        }

        res.json({ message: "Preferences saved successfully." });
    } catch (err) {
        console.error("savePreferences error:", err.message);
        res.status(500).json({ error: "Failed to save preferences." });
    }
};

exports.getPreferences = async (req, res) => {
    const user_id = req.user.id;

    try {
        const result = await pool.query(
            `SELECT
                p.preferred_age_min,
                p.preferred_age_max,
                p.preferred_height_min,
                p.preferred_height_max,
                p.preferred_religion_type_id,
                p.preferred_ethnicity_id,
                rt_pref.religion_name AS preferred_religion_label,
                et_pref.ethnicity_name AS preferred_ethnicity_label,
                dg.dating_goal_name   AS preferred_dating_goal,
                wc.want_children      AS preferred_children,
                po.political_affil    AS preferred_political,
                al.activity_name      AS preferred_activity,
                fo.family_oriented_name AS preferred_family,
                (SELECT COALESCE(array_agg(gt.gender_name ORDER BY gt.gender_type_id), ARRAY[]::text[])
                   FROM preference_genders pg
                   JOIN gender_type gt ON gt.gender_type_id = pg.gender_type_id
                   WHERE pg.preference_id = p.preference_id) AS partner_gender_names
             FROM preferences p
             LEFT JOIN religion_type   rt_pref ON rt_pref.religion_type_id = p.preferred_religion_type_id
             LEFT JOIN ethnicity_type  et_pref ON et_pref.ethnicity_type_id = p.preferred_ethnicity_id
             LEFT JOIN dating_goals    dg ON dg.dating_goals_id    = p.preferred_dating_goals
             LEFT JOIN want_children   wc ON wc.want_children_id   = p.preferred_want_children
             LEFT JOIN political_affil po ON po.political_affil_id = p.preferred_political_affil
             LEFT JOIN activity_level  al ON al.activity_level_id  = p.preferred_activity_level
             LEFT JOIN family_oriented fo ON fo.family_oriented_id = p.preferred_family_oriented
             WHERE p.user_id = $1`,
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.json({ preferences: null });
        }

        const row = result.rows[0];

        function partnerSelectOpenLabel(label) {
            if (label == null || label === "" || label === "No preference") return "";
            return label;
        }

        function partnerToggleLabel(label) {
            if (label == null || label === "") return "No preference";
            return label;
        }

        const rawNames = Array.isArray(row.partner_gender_names) ? row.partner_gender_names : [];
        const genderPrefs = [
            ...new Set(
                rawNames
                    .map((n) => dbGenderNameToPartnerUi(n))
                    .filter(Boolean)
            ),
        ];
        const genderPref =
            genderPrefs.length === 0
                ? "No preference"
                : genderPrefs.length === 1
                    ? genderPrefs[0]
                    : "Multiple";

        res.json({
            preferences: {
                genderPref,
                genderPrefs,
                minAge:         row.preferred_age_min    || 18,
                maxAge:         row.preferred_age_max    || 100,
                minHeight:      row.preferred_height_min || 60,
                maxHeight:      row.preferred_height_max || 80,
                religionPref:   partnerSelectOpenLabel(row.preferred_religion_label),
                ethnicityPref:  partnerSelectOpenLabel(row.preferred_ethnicity_label),
                politicalPref:  partnerSelectOpenLabel(row.preferred_political),
                datingGoalPref: partnerToggleLabel(row.preferred_dating_goal),
                childrenPref:   partnerToggleLabel(row.preferred_children),
                activityPref:   partnerToggleLabel(row.preferred_activity),
                familyOrientedPref: partnerToggleLabel(row.preferred_family),
            }
        });
    } catch (err) {
        console.error("getPreferences error:", err.message);
        res.status(500).json({ error: "Failed to load preferences." });
    }
};
exports.getAvailability = async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await pool.query(
            `SELECT availability_id, day_of_week,
                    to_char(start_time, 'HH24:MI') AS start_time,
                    to_char(end_time,   'HH24:MI') AS end_time
             FROM user_availability
             WHERE user_id = $1
             ORDER BY CASE day_of_week
                WHEN 'monday'    THEN 1 WHEN 'tuesday'   THEN 2
                WHEN 'wednesday' THEN 3 WHEN 'thursday'  THEN 4
                WHEN 'friday'    THEN 5 WHEN 'saturday'  THEN 6
                WHEN 'sunday'    THEN 7 END, start_time`,
            [user_id]
        );
        res.json({ availability: result.rows });
    } catch (err) {
        console.error("getAvailability error:", err.message);
        res.status(500).json({ error: "Failed to fetch availability." });
    }
};

exports.saveAvailability = async (req, res) => {
    const user_id = req.user.id;
    const { unavailable_slots } = req.body;

    if (!Array.isArray(unavailable_slots)) {
        return res.status(400).json({ error: "unavailable_slots must be an array." });
    }

    try {
        await pool.query("DELETE FROM user_availability WHERE user_id = $1", [user_id]);

        for (const slot of unavailable_slots) {
            if (!slot.day_of_week || !slot.start_time || !slot.end_time) continue;
            await pool.query(
                `INSERT INTO user_availability (user_id, day_of_week, start_time, end_time)
                 VALUES ($1, $2, $3, $4)`,
                [user_id, slot.day_of_week, slot.start_time, slot.end_time]
            );
        }

        res.json({ message: "Availability saved.", count: unavailable_slots.length });
    } catch (err) {
        console.error("saveAvailability error:", err.message);
        res.status(500).json({ error: "Failed to save availability." });
    }
};
