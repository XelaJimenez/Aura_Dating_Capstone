const pool            = require("../config/db");
const { evaluateMessage } = require("../conversation/safetyEngine");

exports.sendMessage = async (req, res) => {
    const { match_id, sender_id, content } = req.body;

    if (!match_id || !sender_id || !content) {
        return res.status(400).json({ error: "match_id, sender_id, and content are required." });
    }

    try {
        const matchCheck = await pool.query(
            "SELECT match_id, match_status, user1_id, user2_id FROM matches WHERE match_id = $1",
            [match_id]
        );
        if (matchCheck.rows.length === 0) {
            return res.status(404).json({ error: "Match not found." });
        }
        if (matchCheck.rows[0].match_status !== "active") {
            return res.status(403).json({ error: "Cannot send messages in an inactive match." });
        }

        const { user1_id, user2_id } = matchCheck.rows[0];
        const u1 = parseInt(user1_id, 10);
        const u2 = parseInt(user2_id, 10);
        const sid = parseInt(sender_id, 10);
        const recipientId = sid === u1 ? u2 : u1;

        const evaluation = await evaluateMessage(parseInt(match_id, 10), sid, recipientId, content);

        if (evaluation.decision === "block") {
            return res.status(403).json({
                blocked:  true,
                reason:   evaluation.reason,
                cooldown: evaluation.cooldownApplied,
                cooldown_until: evaluation.cooldownUntil || null,
            });
        }

        const result = await pool.query(
            `INSERT INTO message (match_id, sender_id, content, sent_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING message_id, match_id, sender_id, content, sent_at`,
            [match_id, sid, content]
        );

        const response = {
            message: "Message sent.",
            data:    result.rows[0],
        };

        if (evaluation.decision === "prompt") {
            response.warning = evaluation.reason;
        }

        res.status(201).json(response);
    } catch (err) {
        console.error("sendMessage error:", err.message);
        res.status(500).json({ error: "Failed to send message." });
    }
};

exports.getMessages = async (req, res) => {
    const matchId = parseInt(req.params.matchId);

    if (isNaN(matchId)) {
        return res.status(400).json({ error: "Invalid match ID." });
    }

    try {
        const result = await pool.query(
            `SELECT message_id, sender_id, content, sent_at, read_at
             FROM message
             WHERE match_id = $1
             ORDER BY sent_at ASC`,
            [matchId]
        );

        await pool.query(
            `UPDATE message SET read_at = NOW()
             WHERE match_id = $1 AND sender_id != $2 AND read_at IS NULL`,
            [matchId, req.user.id]
        );

        res.json({ messages: result.rows });
    } catch (err) {
        console.error("getMessages error:", err.message);
        res.status(500).json({ error: "Failed to fetch messages." });
    }
};