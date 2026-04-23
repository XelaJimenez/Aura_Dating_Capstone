import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

function formatMsgTime(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
        return "";
    }
}

function formatCooldownLine(endMs) {
    const remainingMs = Math.max(0, endMs - Date.now());
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (totalSeconds > 60) {
        return `Please wait ${minutes} minutes and ${seconds} seconds before sending another message.`;
    }
    return `Please wait ${seconds} seconds before sending another message.`;
}

function ChatWindow({ match, onBack }) {
    const navigate = useNavigate();
    const { currentUser, token } = useUser();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [banner, setBanner] = useState(null);
    const [inputShake, setInputShake] = useState(false);
    const [inputBlockedBorder, setInputBlockedBorder] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const socketRef = useRef(null);
    const bottomRef = useRef(null);
    const typingTimer = useRef(null);
    const borderTimerRef = useRef(null);
    const shakeTimerRef = useRef(null);
    const lastAttemptedTextRef = useRef("");
    const myUserIdRef = useRef(currentUser?.user_id);
    const inputValueRef = useRef("");
    const [cooldownTick, setCooldownTick] = useState(0);
    useEffect(() => {
        myUserIdRef.current = currentUser?.user_id;
    }, [currentUser?.user_id]);
    useEffect(() => {
        inputValueRef.current = input;
    }, [input]);

    const matchIdNum = match?.match_id != null ? Number(match.match_id) : null;
    const isOwnEvent = (eventSenderId) =>
        eventSenderId == null || Number(eventSenderId) === Number(myUserIdRef.current);

    const clearBanner = () => {
        setBanner(null);
    };

    const parseBannerReason = (reasonText) => {
        const fullText = typeof reasonText === "string" ? reasonText.trim() : "";
        if (!fullText) return { reason: "", cooldown: "" };
        const cooldownMatch = fullText.match(/(Please wait .*?before sending another message\.)$/i);
        if (!cooldownMatch) return { reason: fullText, cooldown: "" };
        const cooldown = cooldownMatch[1].trim();
        const reason = fullText.slice(0, cooldownMatch.index).trim();
        return { reason, cooldown };
    };

    const showBanner = (type, reasonText, cooldownUntilIso) => {
        const { reason, cooldown } = parseBannerReason(reasonText);
        clearBanner();
        let cooldownEndsAt = null;
        if (cooldownUntilIso) {
            const t = new Date(cooldownUntilIso).getTime();
            if (!Number.isNaN(t)) cooldownEndsAt = t;
        }
        setBanner({
            type,
            reason,
            cooldown: cooldownEndsAt != null ? formatCooldownLine(cooldownEndsAt) : cooldown,
            cooldownEndsAt,
            visible: false,
        });
        requestAnimationFrame(() => {
            setBanner((prev) => (prev ? { ...prev, visible: true } : null));
        });
    };

    const triggerBlockInputFeedback = () => {
        setInputShake(true);
        setInputBlockedBorder(true);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        if (borderTimerRef.current) clearTimeout(borderTimerRef.current);
        shakeTimerRef.current = setTimeout(() => {
            setInputShake(false);
            shakeTimerRef.current = null;
        }, 400);
        borderTimerRef.current = setTimeout(() => {
            setInputBlockedBorder(false);
            borderTimerRef.current = null;
        }, 2000);
    };

    useEffect(() => {
        if (matchIdNum == null || Number.isNaN(matchIdNum) || !token) return;

        fetch(`${API_BASE_URL}/messages/${matchIdNum}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.messages) {
                    const myId = Number(myUserIdRef.current);
                    setMessages(
                        data.messages.map((m) => ({
                            messageId: m.message_id,
                            from: Number(m.sender_id) === myId ? "me" : "them",
                            text: m.content,
                            sent_at: m.sent_at,
                        }))
                    );
                }
            })
            .catch(() => {});

        const socket = io(API_BASE_URL, { auth: { token } });
        socketRef.current = socket;

        socket.emit("join_match", { match_id: matchIdNum });

        socket.on("new_message", (msg) => {
            setIsTyping(false);
            const myId = Number(myUserIdRef.current);
            if (
                Number(msg.sender_id) === myId &&
                typeof msg.content === "string" &&
                msg.content.trim() === (lastAttemptedTextRef.current || "").trim() &&
                (inputValueRef.current || "").trim() === (lastAttemptedTextRef.current || "").trim()
            ) {
                setInput("");
            }
            setMessages((prev) => [
                ...prev,
                {
                    messageId: msg.message_id,
                    from: Number(msg.sender_id) === myId ? "me" : "them",
                    text: msg.content,
                    sent_at: msg.sent_at,
                },
            ]);
        });

        socket.on("message_blocked", ({ reason, sender_id, cooldown_until }) => {
            if (!isOwnEvent(sender_id)) return;
            showBanner("block", reason, cooldown_until);
            setInput((prev) => prev || lastAttemptedTextRef.current);
            triggerBlockInputFeedback();
        });

        socket.on("safety_prompt", ({ reason, sender_id }) => {
            if (!isOwnEvent(sender_id)) return;
            showBanner("warn", reason);
        });

        socket.on("user_typing", () => setIsTyping(true));
        socket.on("user_stop_typing", () => setIsTyping(false));

        socket.on("connect_error", (err) => {
            console.error("[chat socket]", err?.message || err);
        });

        return () => {
            if (borderTimerRef.current) clearTimeout(borderTimerRef.current);
            if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
            socket.emit("leave_match", { match_id: matchIdNum });
            socket.disconnect();
        };
    }, [matchIdNum, token]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (banner?.cooldownEndsAt == null) return undefined;
        const id = setInterval(() => setCooldownTick((n) => n + 1), 250);
        return () => clearInterval(id);
    }, [banner?.cooldownEndsAt]);

    const handleSend = () => {
        const text = input.trim();
        if (!text || !socketRef.current || matchIdNum == null || Number.isNaN(matchIdNum)) return;
        lastAttemptedTextRef.current = text;
        socketRef.current.emit("send_message", { match_id: matchIdNum, content: text }, (res) => {
            if (!res || typeof res !== "object") return;
            if (res.blocked) {
                showBanner("block", res.reason || "Your message was blocked.", res.cooldown_until);
                setInput((prev) => prev || lastAttemptedTextRef.current);
                triggerBlockInputFeedback();
                return;
            }
            if (res.warning) {
                showBanner("warn", res.warning);
            }
            setInput("");
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSend();
            return;
        }
        if (!socketRef.current || matchIdNum == null || Number.isNaN(matchIdNum)) return;
        socketRef.current.emit("typing", { match_id: matchIdNum });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
            socketRef.current?.emit("stop_typing", { match_id: matchIdNum });
        }, 1500);
    };

    const handleRequestDate = () => {
        navigate("/dates", { state: { match, returnTo: "/chat" } });
    };

    return (
        <div className="chat-app">
            <header className="chat-app-header">
                <button type="button" className="chat-app-back" onClick={onBack} aria-label="Back to matches">
                    ‹
                </button>
                <div className="chat-app-peer">
                    <img src={match.image} alt={match.name} className="chat-app-peer-avatar" />
                    <div className="chat-app-peer-text">
                        <span className="chat-app-peer-name">{match.name}</span>
                        <span className="chat-app-peer-badge">Your match</span>
                    </div>
                </div>
                <button type="button" className="chat-app-date" onClick={handleRequestDate}>
                    <i className="bi bi-calendar-heart" aria-hidden />
                    Plan date
                </button>
            </header>

            <div className="chat-app-thread">
                {messages.map((msg, i) => {
                    const isEvent = typeof msg.text === "string" && msg.text.startsWith("📅");
                    const rowClass = isEvent
                        ? "chat-msg-row chat-msg-row--event"
                        : msg.from === "me"
                          ? "chat-msg-row chat-msg-row--out"
                          : "chat-msg-row chat-msg-row--in";
                    const bubbleClass = isEvent
                        ? "chat-msg-bubble chat-msg-bubble--event"
                        : msg.from === "me"
                          ? "chat-msg-bubble chat-msg-bubble--out"
                          : "chat-msg-bubble chat-msg-bubble--in";
                    const key = msg.messageId != null ? `id-${msg.messageId}` : `k-${i}-${msg.sent_at || ""}`;
                    const t = formatMsgTime(msg.sent_at);
                    return (
                        <div key={key} className={rowClass}>
                            <div className="chat-msg-stack">
                                <div className={bubbleClass}>{msg.text}</div>
                                {!isEvent && t && (
                                    <div
                                        className={`chat-msg-time ${msg.from === "me" ? "chat-msg-time--out" : "chat-msg-time--in"}`}
                                    >
                                        {t}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {isTyping && (
                    <div className="chat-msg-row chat-msg-row--in">
                        <div className="chat-msg-typing" aria-hidden>
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>
                )}
                <div ref={bottomRef} className="chat-app-thread-end" />
            </div>

            {banner && (
                <div
                    className={`chat-app-banner ${
                        banner.type === "block" ? "chat-app-banner--block" : "chat-app-banner--warn"
                    } ${banner.visible ? "chat-app-banner--visible" : ""}`}
                >
                    <div className="chat-app-banner-row">
                        <span className="chat-app-banner-icon" aria-hidden>
                            {banner.type === "block" ? "✕" : "⚠"}
                        </span>
                        <span className="chat-app-banner-text">{banner.reason}</span>
                        <button
                            type="button"
                            className="chat-app-banner-close"
                            onClick={clearBanner}
                            aria-label="Dismiss warning"
                        >
                            ×
                        </button>
                    </div>
                    {banner.type === "block" && (banner.cooldownEndsAt != null || banner.cooldown) && (
                        <div className="chat-app-banner-cooldown" data-cooldown-tick={cooldownTick}>
                            {banner.cooldownEndsAt != null ? formatCooldownLine(banner.cooldownEndsAt) : banner.cooldown}
                        </div>
                    )}
                </div>
            )}

            <footer className="chat-app-composer">
                <div
                    className={`chat-app-composer-inner ${inputShake ? "chat-app-composer-inner--shake" : ""} ${
                        inputBlockedBorder ? "chat-app-composer-inner--blocked" : ""
                    }`}
                >
                    <input
                        id="chat-message-input"
                        name="message"
                        className="chat-app-input"
                        placeholder="Message…"
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                        }}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                    />
                    <button type="button" className="chat-app-send" onClick={handleSend} aria-label="Send message">
                        <i className="bi bi-send-fill" aria-hidden />
                    </button>
                </div>
            </footer>
        </div>
    );
}

export default ChatWindow;
