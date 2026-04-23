import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

const DATE_SLOTS = [
    { label: "Friday 6PM – 10PM",   day: "friday",   start: "18:00", end: "22:00" },
    { label: "Saturday 12PM – 5PM", day: "saturday", start: "12:00", end: "17:00" },
    { label: "Saturday 6PM – 10PM", day: "saturday", start: "18:00", end: "22:00" },
    { label: "Sunday 12PM – 5PM",   day: "sunday",   start: "12:00", end: "17:00" },
    { label: "Sunday 6PM – 9PM",    day: "sunday",   start: "18:00", end: "21:00" },
];

function slotKey(slot) {
    return `${slot.day}_${slot.start}_${slot.end}`;
}

function UserAvailability() {
    const { token }    = useUser();
    const navigate     = useNavigate();
    const [unavailable, setUnavailable] = useState(new Set());
    const [loading,  setLoading]        = useState(true);
    const [saving,   setSaving]         = useState(false);
    const [saveMsg,  setSaveMsg]        = useState("");

    useEffect(() => {
        if (!token) return;
        fetch(`${API_BASE_URL}/profile/availability`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                if (data.availability) {
                    const blocked = new Set(
                        data.availability.map(a =>
                            `${a.day_of_week}_${a.start_time}_${a.end_time}`
                        )
                    );
                    setUnavailable(blocked);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [token]);

    const toggleSlot = (slot) => {
        const key = slotKey(slot);
        setUnavailable(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveMsg("");

        const unavailable_slots = DATE_SLOTS
            .filter(s => unavailable.has(slotKey(s)))
            .map(s => ({ day_of_week: s.day, start_time: s.start + ":00", end_time: s.end + ":00" }));

        try {
            const res = await fetch(`${API_BASE_URL}/profile/availability`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ unavailable_slots }),
            });

            setSaveMsg(res.ok ? "✅ Availability saved!" : "Something went wrong. Please try again.");
        } catch {
            setSaveMsg("Could not connect to server.");
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(""), 3000);
        }
    };

    return (
        <>
            <Navbar />
            <div className="faded-background d-flex flex-column justify-content-center align-items-center min-vh-100 py-5">
                <div className="login-card form-card p-4 mb-4">

                    <h4 className="text-center mb-1">📅 Availability Settings</h4>
                    <p className="text-center text-muted small mb-4">
                        Select the times you are <strong>not available</strong> for dates.
                        Other users will not be able to schedule dates with you during these times.
                    </p>

                    {loading ? (
                        <p className="text-center text-muted">Loading...</p>
                    ) : (
                        <>
                            <h5 className="section-title">Date Time Slots</h5>
                            <div className="d-flex flex-column gap-3 mb-4">
                                {DATE_SLOTS.map((slot) => {
                                    const blocked = unavailable.has(slotKey(slot));
                                    return (
                                        <div
                                            key={slotKey(slot)}
                                            onClick={() => toggleSlot(slot)}
                                            className={`availability-slot${blocked ? " availability-slot--blocked" : ""}`}
                                        >
                                            <div className="d-flex align-items-center gap-3">
                                                <div className={`availability-slot-indicator${blocked ? " availability-slot-indicator--blocked" : ""}`}>
                                                    {blocked ? "✕" : "✓"}
                                                </div>
                                                <div>
                                                    <div className="fw-bold">{slot.label}</div>
                                                    <div className={`small ${blocked ? "text-danger" : "text-success"}`}>
                                                        {blocked ? "Unavailable" : "Available"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="availability-summary mb-4">
                                <p className="small mb-1">
                                    <span className="availability-dot availability-dot--available" />
                                    {DATE_SLOTS.length - unavailable.size} slots available
                                </p>
                                <p className="small mb-0">
                                    <span className="availability-dot availability-dot--blocked" />
                                    {unavailable.size} slots blocked
                                </p>
                            </div>

                            {saveMsg && (
                                <div className={`alert py-2 text-center mb-3 ${saveMsg.startsWith("✅") ? "alert-success" : "alert-danger"}`}>
                                    {saveMsg}
                                </div>
                            )}

                            <div className="text-center">
                                <button
                                    className="btn btn-danger me-2"
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "Save Availability"}
                                </button>
                                <button
                                    className="btn btn-outline-danger"
                                    onClick={() => navigate(-1)}
                                >
                                    Back
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

export default UserAvailability;