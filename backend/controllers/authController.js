const crypto      = require("crypto");
const pool        = require("../config/db");
const bcrypt      = require("bcrypt");
const { generateToken } = require("../utils/jwtHelper");
const { getTrustDisplayForUser } = require("../services/trustService");
const { parseCityStateLocation } = require("../utils/parseCityStateLocation");
const { geocodeCityState } = require("../services/geocodeCityState");
const SALT_ROUNDS = 10;

exports.signup = async (req, res) => {
    const { firstName, lastName, location, dob, age, email, password } = req.body;

    if (!firstName || !lastName || !location || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }

    const locParsed = parseCityStateLocation(location);
    if (!locParsed.ok) {
        return res.status(400).json({ error: locParsed.error });
    }

    let date_of_birth;
    if (dob) {
        const parts = dob.split("/");
        if (parts.length === 3) {
            const [month, day, year] = parts;
            date_of_birth = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            if (new Date().getFullYear() - parseInt(year) < 18) {
                return res.status(400).json({ error: "You must be 18 or older." });
            }
        } else {
            return res.status(400).json({ error: "Invalid date of birth format." });
        }
    } else if (age) {
        if (parseInt(age) < 18) return res.status(400).json({ error: "You must be 18 or older." });
        date_of_birth = `${new Date().getFullYear() - parseInt(age)}-01-01`;
    } else {
        return res.status(400).json({ error: "Date of birth is required." });
    }

    if (!email.includes("@")) return res.status(400).json({ error: "Invalid email address." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    try {
        const existing = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        let latitude = null;
        let longitude = null;
        try {
            const geo = await geocodeCityState(locParsed.city, locParsed.state);
            if (geo) {
                latitude = geo.latitude;
                longitude = geo.longitude;
            }
        } catch {
            latitude = null;
            longitude = null;
        }

        const result = await pool.query(
            `INSERT INTO users
                (first_name, last_name, email, password_hash, date_of_birth,
                 location_city, location_state, latitude, longitude,
                 account_status, created_at, role_id, tier_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',NOW(),1,1)
             RETURNING user_id, first_name, last_name, email`,
            [
                firstName,
                lastName,
                email,
                password_hash,
                date_of_birth,
                locParsed.city,
                locParsed.state,
                latitude,
                longitude,
            ]
        );
        const newUser = result.rows[0];

        await pool.query(
            "INSERT INTO trust_score (user_id, internal_score, last_updated) VALUES ($1, 75, NOW())",
            [newUser.user_id]
        );

        const token = generateToken(newUser.user_id);

        res.status(201).json({ message: "Account created successfully.", token, user: newUser });
    } catch (err) {
        console.error("signup error:", err.message);
        res.status(500).json({ error: "Signup failed. Please try again." });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    try {
        const result = await pool.query(
            `SELECT user_id, first_name, last_name, email, password_hash, account_status
             FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const user = result.rows[0];

        if (user.account_status !== "active") {
            return res.status(403).json({ error: "This account has been suspended or banned." });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        await pool.query("UPDATE users SET last_login = NOW() WHERE user_id = $1", [user.user_id]);

        const token = generateToken(user.user_id);

        res.json({
            message: "Login successful.",
            token,
            user: {
                user_id:    user.user_id,
                first_name: user.first_name,
                last_name:  user.last_name,
                email:      user.email,
            }
        });
    } catch (err) {
        console.error("login error:", err.message);
        res.status(500).json({ error: "Login failed. Please try again." });
    }
};

function generateTempPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < 12; i += 1) {
        out += chars[crypto.randomInt(0, chars.length)];
    }
    return out;
}

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const successMessage = "A temporary password has been sent.";

    if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required." });
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
        return res.status(400).json({ error: "Please enter a valid email." });
    }

    try {
        const result = await pool.query(
            "SELECT user_id, email FROM users WHERE LOWER(TRIM(email)) = $1",
            [normalized]
        );

        if (result.rows.length === 0) {
            console.log("forgot-password: no user for submitted email (not disclosed in response)");
            return res.json({ message: successMessage });
        }

        const user = result.rows[0];
        const tempPassword = generateTempPassword();
        const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

        await pool.query("UPDATE users SET password_hash = $1 WHERE user_id = $2", [
            password_hash,
            user.user_id,
        ]);

        console.log(`forgot-password: temporary password for ${user.email}: ${tempPassword}`);

        return res.json({
            message: successMessage,
            tempPassword,
        });
    } catch (err) {
        console.error("forgotPassword error:", err.message);
        res.status(500).json({ error: "Could not process request. Please try again." });
    }
};

exports.getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.date_of_birth,
                u.height_inches,
                u.location_city,
                u.location_state,
                u.bio,
                u.profile_photo_url,
                gt.gender_name,
                rt.religion_name,
                et.ethnicity_name,
                ec.education_career_name,
                sm.smoking_name,
                dr.drinking_name,
                co.coffee_name,
                di.diet_name,
                al.activity_name,
                mu.music_name,
                pe.personality_type_name,
                dg.dating_goal_name,
                po.political_affil      AS political_name,
                wc.want_children        AS children_name,
                fo.family_oriented_name,
                gm.isgamer_name,
                rd.isreader_name,
                tr.travel_interest_name,
                pi.pet_interest_name,
                az.astrology_sign       AS astrology_name,
                ts.internal_score       AS trust_score,
                u.music                 AS score_music_id,
                u.travel                AS score_travel_id,
                u.pet_interest          AS score_pet_interest_id,
                u.reader                AS score_reader_id,
                u.gamer                 AS score_gamer_id,
                u.activity_level        AS score_activity_level_id,
                u.drinking_id           AS score_drinking_id,
                u.smoking_id            AS score_smoking_id,
                u.coffee_id             AS score_coffee_id,
                u.diet_id               AS score_diet_id,
                u.personality_type      AS score_personality_type_id,
                u.political             AS score_political_id,
                u.dating_goals          AS score_dating_goals_id,
                u.children              AS score_children_id,
                u.religion_id           AS score_religion_id,
                u.family_oriented       AS score_family_oriented_id,
                u.education_career_id   AS score_education_career_id
            FROM users u
            LEFT JOIN gender_type      gt ON gt.gender_type_id      = u.gender_identity
            LEFT JOIN religion_type    rt ON rt.religion_type_id    = u.religion_id
            LEFT JOIN ethnicity_type   et ON et.ethnicity_type_id   = u.ethnicity_id
            LEFT JOIN education_career ec ON ec.education_career_id = u.education_career_id
            LEFT JOIN smoking          sm ON sm.smoking_id          = u.smoking_id
            LEFT JOIN drinking         dr ON dr.drinking_id         = u.drinking_id
            LEFT JOIN coffee_drinker   co ON co.coffee_id           = u.coffee_id
            LEFT JOIN diet             di ON di.diet_id             = u.diet_id
            LEFT JOIN activity_level   al ON al.activity_level_id  = u.activity_level
            LEFT JOIN music            mu ON mu.music_id            = u.music
            LEFT JOIN personality_type pe ON pe.personality_type_id = u.personality_type
            LEFT JOIN dating_goals     dg ON dg.dating_goals_id     = u.dating_goals
            LEFT JOIN political_affil  po ON po.political_affil_id  = u.political
            LEFT JOIN want_children    wc ON wc.want_children_id    = u.children
            LEFT JOIN family_oriented  fo ON fo.family_oriented_id  = u.family_oriented
            LEFT JOIN gamer            gm ON gm.isgamer_id          = u.gamer
            LEFT JOIN reader           rd ON rd.isreader_id         = u.reader
            LEFT JOIN travel_interest  tr ON tr.travel_interest_id  = u.travel
            LEFT JOIN pet_interest     pi ON pi.pet_interest_id     = u.pet_interest
            LEFT JOIN astrology_sign   az ON az.astrology_sign_id   = u.astrology
            LEFT JOIN trust_score      ts ON ts.user_id             = u.user_id
            WHERE u.user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const row = result.rows[0];
        let trust_display = null;
        try {
            trust_display = await getTrustDisplayForUser(userId);
        } catch {
            trust_display = null;
        }

        res.json({ user: { ...row, trust_display } });
    } catch (err) {
        console.error("getMe error:", err.message);
        res.status(500).json({ error: "Failed to load profile." });
    }
};