const { Server }          = require("socket.io");
const { evaluateMessage } = require("../conversation/safetyEngine");
const { verifyToken }     = require("../utils/jwtHelper");
const pool                = require("../config/db");

/** pg / JWT may mix number vs string — normalize so match membership never fails. */
function numId(v) {
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) ? null : n;
}

/** Set by initSocketServer — used to broadcast messages created via HTTP (e.g. date flow). */
let ioInstance = null;

function initSocketServer(httpServer) {
    // Reflect request Origin so Vite works from localhost OR 127.0.0.1 (different browser origins).
    const io = new Server(httpServer, {
        cors: {
            origin:      true,
            methods:     ["GET", "POST"],
            credentials: true
        }
    });

    io.use((socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace("Bearer ", "");
        if (!token) return next(new Error("No token provided."));
        try {
            const decoded = verifyToken(token);
            socket.userId = numId(decoded.id);
            if (socket.userId == null) return next(new Error("Invalid token."));
            next();
        } catch {
            next(new Error("Invalid token."));
        }
    });

    io.on("connection", (socket) => {
        console.log(`[Socket] Connected: user ${socket.userId}`);

        socket.on("join_match", ({ match_id }) => {
            const mid = numId(match_id);
            if (mid == null) return;
            socket.join(`match_${mid}`);
        });

        socket.on("leave_match", ({ match_id }) => {
            const mid = numId(match_id);
            if (mid == null) return;
            socket.leave(`match_${mid}`);
        });

        socket.on("send_message", async ({ match_id, content }) => {
            const mid = numId(match_id);
            if (mid == null || !content?.trim()) return;

            try {
                const matchCheck = await pool.query(
                    "SELECT match_status, user1_id, user2_id FROM matches WHERE match_id = $1",
                    [mid]
                );

                if (matchCheck.rows.length === 0) {
                    return socket.emit("error", { message: "Match not found." });
                }
                if (matchCheck.rows[0].match_status !== "active") {
                    return socket.emit("error", { message: "Match is not active." });
                }

                const { user1_id, user2_id } = matchCheck.rows[0];
                const u1 = numId(user1_id);
                const u2 = numId(user2_id);
                const uid = numId(socket.userId);
                if (uid == null || u1 == null || u2 == null) {
                    return socket.emit("error", { message: "Invalid match or user." });
                }
                if (uid !== u1 && uid !== u2) {
                    return socket.emit("error", { message: "You are not part of this match." });
                }

                const recipientId = uid === u1 ? u2 : u1;

                const evaluation = await evaluateMessage(mid, uid, recipientId, content.trim());

                if (evaluation.decision === "block") {
                    return socket.emit("message_blocked", {
                        reason:   evaluation.reason,
                        category: evaluation.category,
                        sender_id: uid,
                        cooldown_until: evaluation.cooldownUntil || null
                    });
                }

                if (evaluation.decision === "prompt") {
                    socket.emit("safety_prompt", {
                        reason: evaluation.reason,
                        sender_id: uid
                    });
                }

                const result = await pool.query(
                    `INSERT INTO message (match_id, sender_id, content, sent_at)
                     VALUES ($1, $2, $3, NOW())
                     RETURNING message_id, match_id, sender_id, content, sent_at`,
                    [mid, uid, content.trim()]
                );

                const senderNameResult = await pool.query(
                    `SELECT first_name, last_name FROM users WHERE user_id = $1 LIMIT 1`,
                    [uid]
                );
                const senderName = senderNameResult.rows[0]
                    ? `${senderNameResult.rows[0].first_name || ""} ${senderNameResult.rows[0].last_name || ""}`.trim()
                    : "Your match";

                await pool.query(
                    `UPDATE notifications
                     SET is_read = true
                     WHERE user_id = $1
                       AND type = 'new_message'
                       AND is_read = false
                       AND (payload->>'match_id')::int = $2`,
                    [recipientId, mid]
                );

                await pool.query(
                    `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
                     VALUES ($1, 'new_message', $2, false, NOW())`,
                    [
                        recipientId,
                        JSON.stringify({
                            match_id: mid,
                            sender_id: uid,
                            sender_name: senderName || "Your match",
                            message_id: result.rows[0].message_id,
                            preview: content.trim().slice(0, 140),
                        }),
                    ]
                );

                io.to(`match_${mid}`).emit("new_message", result.rows[0]);

            } catch (err) {
                console.error("[Socket] send_message error:", err.message);
                socket.emit("error", { message: "Failed to send message." });
            }
        });

        socket.on("typing", ({ match_id }) => {
            const mid = numId(match_id);
            if (mid == null) return;
            socket.to(`match_${mid}`).emit("user_typing", { user_id: socket.userId });
        });

        socket.on("stop_typing", ({ match_id }) => {
            const mid = numId(match_id);
            if (mid == null) return;
            socket.to(`match_${mid}`).emit("user_stop_typing", { user_id: socket.userId });
        });

        socket.on("disconnect", () => {
            console.log(`[Socket] Disconnected: user ${socket.userId}`);
        });
    });

    ioInstance = io;
    return io;
}

initSocketServer.getIO = () => ioInstance;

module.exports = initSocketServer;