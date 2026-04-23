import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

const READ_ON_VIEW_TYPES = ["date_accepted", "date_declined", "trust_feedback", "match_created", "new_message"];

export default function Notifications() {
    const { currentUser, token, bumpNotificationEpoch } = useUser();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading]             = useState(true);
    const [responding, setResponding]       = useState(null);

    useEffect(() => {
        if (!currentUser || !token) return;
        let cancelled = false;
        (async () => {
            try {
                await fetch(`${API_BASE_URL}/dates/notifications/${currentUser.user_id}/read`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ types: READ_ON_VIEW_TYPES }),
                });
            } catch {
                /* ignore */
            }
            if (cancelled) return;
            try {
                const r = await fetch(`${API_BASE_URL}/dates/notifications/${currentUser.user_id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await r.json().catch(() => ({}));
                if (!cancelled) setNotifications(data.notifications || []);
            } catch {
                if (!cancelled) setNotifications([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    bumpNotificationEpoch?.();
                }
            }
        })();
        return () => { cancelled = true; };
    }, [currentUser, token, bumpNotificationEpoch]);

    const handleRespond = async (scheduleId, response) => {
        setResponding(scheduleId);
        try {
            await fetch(`${API_BASE_URL}/dates/${scheduleId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ response, user_id: currentUser.user_id }),
            });
            setNotifications(prev =>
                prev.map(n => {
                    const p = typeof n.payload === "string" ? JSON.parse(n.payload) : n.payload;
                    if (p?.schedule_id === scheduleId) return { ...n, is_read: true, responded: response };
                    return n;
                })
            );
        } catch {}
        finally { setResponding(null); }
    };

    const formatDate = (dt) => {
        if (!dt) return "";
        return new Date(dt).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit",
        });
    };

    const parsePayload = (n) => {
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
    };

    const renderNotification = (n) => {
        const payload = parsePayload(n);

        if (n.type === "date_request") {
            return (
                <div key={n.notification_id} className="notification-card">
                    <div className="notification-icon">📅</div>
                    <div className="notification-body">
                        <div className="notification-title">Date Request</div>
                        <div className="notification-detail">
                            {payload?.venue_name && <span>{payload.venue_name}</span>}
                            {payload?.proposed_datetime && (
                                <span> · {formatDate(payload.proposed_datetime)}</span>
                            )}
                        </div>
                        {!n.responded && !n.is_read && (
                            <div className="notification-actions">
                                <button
                                    className="btn btn-sm btn-danger"
                                    disabled={responding === payload?.schedule_id}
                                    onClick={() => handleRespond(payload.schedule_id, "approved")}
                                >
                                    Accept
                                </button>
                                <button
                                    className="btn btn-sm btn-outline-danger"
                                    disabled={responding === payload?.schedule_id}
                                    onClick={() => handleRespond(payload.schedule_id, "rejected")}
                                >
                                    Decline
                                </button>
                            </div>
                        )}
                        {(n.responded || n.is_read) && (
                            <div className={`notification-status ${n.responded === "approved" ? "notification-status-accepted" : "notification-status-read"}`}>
                                {n.responded === "approved" ? "✅ Accepted" : n.responded === "rejected" ? "❌ Declined" : "Seen"}
                            </div>
                        )}
                    </div>
                    <div className="notification-time">{formatDate(n.created_at)}</div>
                </div>
            );
        }

        if (n.type === "date_accepted") {
            return (
                <div key={n.notification_id} className="notification-card">
                    <div className="notification-icon">🎉</div>
                    <div className="notification-body">
                        <div className="notification-title">Date Accepted!</div>
                        <div className="notification-detail">
                            {payload?.venue_name} · {formatDate(payload?.proposed_datetime)}
                        </div>
                        <button
                            className="btn btn-sm btn-danger mt-2"
                            onClick={() => navigate("/chat")}
                        >
                            Go to Chat
                        </button>
                    </div>
                    <div className="notification-time">{formatDate(n.created_at)}</div>
                </div>
            );
        }

        if (n.type === "date_declined") {
            return (
                <div key={n.notification_id} className="notification-card">
                    <div className="notification-icon">❌</div>
                    <div className="notification-body">
                        <div className="notification-title">Date request declined</div>
                        <div className="notification-detail">
                            {payload?.responder_name ? `${payload.responder_name} declined. ` : ""}
                            {payload?.venue_name && <span>{payload.venue_name}</span>}
                            {payload?.proposed_datetime && (
                                <span> · {formatDate(payload.proposed_datetime)}</span>
                            )}
                        </div>
                    </div>
                    <div className="notification-time">{formatDate(n.created_at)}</div>
                </div>
            );
        }

        if (n.type === "trust_feedback") {
            return (
                <div key={n.notification_id} className="notification-card">
                    <div className="notification-icon">🛡️</div>
                    <div className="notification-body">
                        <div className="notification-title">Safety trust updated</div>
                        <div className="notification-detail">
                            Recent date feedback affected your trust score. Open Profile to see your current rating.
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm notif-appeal-btn mt-2"
                            onClick={() => navigate("/appeals")}
                        >
                            Submit trust appeal
                        </button>
                    </div>
                    <div className="notification-time">{formatDate(n.created_at)}</div>
                </div>
            );
        }

        if (n.type === "post_date_survey") {
            const scheduleId = payload?.schedule_id ?? payload?.scheduleId;
            return (
                <div key={n.notification_id} className="notification-card">
                    <div className="notification-icon">📝</div>
                    <div className="notification-body">
                        <div className="notification-title">How did your date go?</div>
                        <div className="notification-detail">Share your safety check-in.</div>
                        <button
                            type="button"
                            className="btn btn-sm btn-danger mt-2"
                            disabled={scheduleId == null}
                            onClick={() => {
                                if (scheduleId == null) return;
                                navigate("/postDate", { state: { schedule_id: scheduleId } });
                            }}
                        >
                            Complete check-in
                        </button>
                        {scheduleId == null && (
                            <p className="text-danger small mb-0 mt-1">Missing schedule reference — refresh or contact support.</p>
                        )}
                    </div>
                    <div className="notification-time">{formatDate(n.created_at)}</div>
                </div>
            );
        }

        if (n.type === "match_created") {
            return (
                <div key={n.notification_id} className="notification-card">
                    <div className="notification-icon">💘</div>
                    <div className="notification-body">
                        <div className="notification-title">It&apos;s a match!</div>
                        <div className="notification-detail">
                            {payload?.matcher_name || "Someone"} liked you back. You can chat now.
                        </div>
                        <button
                            className="btn btn-sm btn-danger mt-2"
                            onClick={() =>
                                navigate("/chat", {
                                    state: { openMatchId: parseInt(payload?.match_id, 10) || null },
                                })
                            }
                        >
                            Open chat
                        </button>
                    </div>
                    <div className="notification-time">{formatDate(n.created_at)}</div>
                </div>
            );
        }

        if (n.type === "new_message") {
            return (
                <div key={n.notification_id} className="notification-card">
                    <div className="notification-icon">💬</div>
                    <div className="notification-body">
                        <div className="notification-title">New message</div>
                        <div className="notification-detail">
                            {payload?.sender_name || "Your match"}: {payload?.preview || "Open chat to read the latest message."}
                        </div>
                        <button
                            className="btn btn-sm btn-danger mt-2"
                            onClick={() => navigate("/chat")}
                        >
                            Open messages
                        </button>
                    </div>
                    <div className="notification-time">{formatDate(n.created_at)}</div>
                </div>
            );
        }

        return null;
    };

    return (
        <>
            <Navbar />
            <div className="faded-background min-vh-100 min-vw-100 d-flex justify-content-center pt-4">
                <div className="login-card p-4 mb-4 notifications-card">
                    <h4 className="section-title mb-3">🔔 Notifications</h4>

                    {loading && <p className="text-muted text-center">Loading...</p>}

                    {!loading && notifications.length === 0 && (
                        <p className="text-muted text-center">No notifications yet.</p>
                    )}

                    {!loading && notifications.map(renderNotification)}
                </div>
            </div>
        </>
    );
}