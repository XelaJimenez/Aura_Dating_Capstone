const pool = require("../config/db");

exports.uploadMiddleware = (req, res, next) => next();

exports.uploadPhoto = async (req, res) => {
    const user_id = req.user?.id;
    if (!user_id) return res.status(400).json({ error: "Not authenticated." });

    const { photo_url } = req.body;
    if (photo_url == null || photo_url === "") {
        return res.status(400).json({ error: "photo_url is required." });
    }
    if (typeof photo_url !== "string") {
        return res.status(400).json({ error: "photo_url must be a string." });
    }
    const trimmed = photo_url.trim();
    const okData = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(trimmed);
    const okHttp = /^https?:\/\//i.test(trimmed);
    if (!okData && !okHttp) {
        return res.status(400).json({ error: "Invalid image URL. Use https image URL or a data:image base64 data URL." });
    }

    try {
        await pool.query(
            "UPDATE users SET profile_photo_url = $1 WHERE user_id = $2",
            [trimmed, user_id]
        );
        await pool.query("DELETE FROM photo WHERE user_id = $1 AND is_primary = true", [user_id]);
        await pool.query(
            `INSERT INTO photo (user_id, photo_url, is_primary, uploaded_at)
             VALUES ($1, $2, true, NOW())`,
            [user_id, trimmed]
        );
        res.json({ message: "Photo updated.", photo_url: trimmed });
    } catch (err) {
        console.error("uploadPhoto error:", err.message);
        res.status(500).json({ error: "Failed to update photo." });
    }
};