import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";
const READ_ON_VIEW_TYPES = ["date_accepted", "date_declined", "trust_feedback", "match_created", "new_message"];

function parseNotifPayload(n) {
    const raw = n.payload;
    if (raw == null) return {};
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }
    return raw;
}

function Navbar() {
    const navigate = useNavigate();
    const { currentUser, token, notificationEpoch } = useUser();
    const userId = currentUser?.user_id;
    const [menuOpen,  setMenuOpen]  = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);

    const fetchNotifications = useCallback(() => {
        if (!userId || !token) return;
        fetch(`${API_BASE_URL}/dates/notifications/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                if (data.notifications) {
                    setNotifications(data.notifications);
                    setUnread(data.notifications.filter(n => !n.is_read).length);
                }
            })
            .catch(() => {});
    }, [userId, token]);

    const markReadOnViewTypes = useCallback(async () => {
        if (!userId || !token) return;
        try {
            await fetch(`${API_BASE_URL}/dates/notifications/${userId}/read`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ types: READ_ON_VIEW_TYPES }),
            });
        } catch {}
    }, [userId, token]);

    const bellRef = useRef(null);
    const panelRef = useRef(null);

    useEffect(() => {
        if (!userId || !token) return;
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [userId, token, fetchNotifications, notificationEpoch]);

    useEffect(() => {
        if (!notifOpen) return;
        const onDocMouseDown = (e) => {
            const t = e.target;
            if (bellRef.current?.contains(t) || panelRef.current?.contains(t)) return;
            setNotifOpen(false);
        };
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, [notifOpen]);

    const handleRespond = async (scheduleId, response) => {
        try {
            await fetch(`${API_BASE_URL}/dates/${scheduleId}/respond`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ response, user_id: userId }),
            });
            fetchNotifications();
        } catch (err) {
            console.error("Respond error:", err);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return "";
        return new Date(iso).toLocaleString([], {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
    };

    const formatNotif = (n) => {
        const p = parseNotifPayload(n);
        if (n.type === "date_request") {
            return {
                icon:        "📅",
                title:       `${p.sender_name || "Someone"} sent a date request`,
                body:        `${p.venue_name || "Venue"} · ${formatDate(p.proposed_datetime)}`,
                showActions: true,
                scheduleId:  p.schedule_id,
            };
        }
        if (n.type === "date_accepted") {
            return {
                icon:        "✅",
                title:       `${p.responder_name || "Your match"} accepted your date!`,
                body:        `${p.venue_name || "Your date"} on ${formatDate(p.proposed_datetime)} is confirmed.`,
                showActions: false,
            };
        }
        if (n.type === "date_declined") {
            return {
                icon:        "❌",
                title:       `${p.responder_name || "Your match"} declined your date request.`,
                body:        p.venue_name ? `Venue: ${p.venue_name}` : "",
                showActions: false,
            };
        }
        if (n.type === "post_date_survey") {
            return {
                icon:               "📝",
                title:              "Post-date safety check-in",
                body:               `How did your date at ${p.venue_name || "the venue"} go?`,
                showActions:        false,
                surveyScheduleId:   p.schedule_id ?? p.scheduleId,
            };
        }
        if (n.type === "trust_feedback") {
            return {
                icon:             "🛡️",
                title:            "Your safety trust was updated",
                body:             "Recent date feedback affected your score. Open Profile to see details, or submit an appeal if you disagree.",
                showActions:      false,
                showAppealButton: true,
            };
        }
        if (n.type === "match_created") {
            return {
                icon:        "💘",
                title:       `${p.matcher_name || "Someone"} matched with you!`,
                body:        "You both liked each other. Start chatting now.",
                showActions: false,
                showChatButton: true,
            };
        }
        if (n.type === "new_message") {
            return {
                icon: "💬",
                title: `${p.sender_name || "Your match"} sent a message`,
                body: p.preview || "Open chat to read the message.",
                showActions: false,
                matchId: p.match_id,
            };
        }
        return { icon: "🔔", title: n.type, body: "", showActions: false };
    };

    return (
        <>
            <nav className="navbar navbar-dark navbar-color px-4">
                <span className="navbar-brand navbar-toggle" onClick={() => setMenuOpen(!menuOpen)}>☰</span>
                <div className="d-flex gap-3 text-white align-items-center">
                    <div
                        ref={bellRef}
                        className="notif-bell-wrap"
                        onClick={() => {
                            setNotifOpen((prev) => {
                                const opening = !prev;
                                if (opening) {
                                    markReadOnViewTypes().finally(() => fetchNotifications());
                                } else {
                                    fetchNotifications();
                                }
                                return opening;
                            });
                        }}
                    >
                        <i className="bi bi-bell"></i>
                        {unread > 0 && (
                            <span className="notif-badge">{unread}</span>
                        )}
                    </div>
                </div>
            </nav>

            {notifOpen && (
                <div ref={panelRef} className="notif-panel">
                    <h5 className="section-title">🔔 Notifications</h5>
                    {notifications.length === 0 && (
                        <p className="text-muted small text-center mt-3">No notifications yet.</p>
                    )}
                    {notifications.map((n) => {
                        const f = formatNotif(n);
                        return (
                            <div key={n.notification_id} className="notif-item">
                                <div className="notif-item__icon">{f.icon}</div>
                                <div className="notif-item__body">
                                    <div className="notif-item__title">{f.title}</div>
                                    <div className="notif-item__text">{f.body}</div>
                                    <div className="notif-item__time">{formatDate(n.created_at)}</div>
                                    {f.showActions && !n.is_read && (
                                        <div className="d-flex gap-2 mt-2">
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleRespond(f.scheduleId, "approved")}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => handleRespond(f.scheduleId, "rejected")}
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                    {f.showActions && n.is_read && (
                                        <div className="notif-item__responded">Responded</div>
                                    )}
                                    {n.type === "post_date_survey" && f.surveyScheduleId != null && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger mt-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate("/postDate", {
                                                    state: { schedule_id: f.surveyScheduleId },
                                                });
                                                setNotifOpen(false);
                                            }}
                                        >
                                            Complete check-in
                                        </button>
                                    )}
                                    {n.type === "trust_feedback" && f.showAppealButton && (
                                        <button
                                            type="button"
                                            className="btn btn-sm notif-appeal-btn mt-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate("/appeals");
                                                setNotifOpen(false);
                                            }}
                                        >
                                            Submit trust appeal
                                        </button>
                                    )}
                                    {n.type === "match_created" && f.showChatButton && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger mt-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate("/chat");
                                                setNotifOpen(false);
                                            }}
                                        >
                                            Open messages
                                        </button>
                                    )}
                                    {n.type === "new_message" && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger mt-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate("/chat", {
                                                    state: {
                                                        openMatchId: parseInt(f.matchId, 10) || null,
                                                    },
                                                });
                                                setNotifOpen(false);
                                            }}
                                        >
                                            Open chat
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className={`sidebar ${menuOpen ? "open" : ""}`}>
                <button className="close-btn" onClick={() => setMenuOpen(false)}>×</button>
                <ul className="list-unstyled mt-4">
                    <li><a href="/profile">Profile</a></li>
                    <li><a href="/matching">Matching</a></li>
                    <li><a href="/availability">Availability</a></li>
                    <li><a href="/chat">Messages</a></li>
                    <li><a href="/appeals">Trust appeal</a></li>
                    <li><a href="/">Logout</a></li>
                </ul>
            </div>
        </>
    );
}

export default Navbar;