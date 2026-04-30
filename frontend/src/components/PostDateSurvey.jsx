import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

function ToggleGroup({ options, value, onChange }) {
    return (
        <div className="d-flex flex-wrap gap-2 mt-1">
            {options.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={`toggle-btn ${value === opt ? "toggle-btn-active" : ""}`}
                >
                    {opt}
                </button>
            ))}
        </div>
    );
}

function PostDateSurvey() {
    const navigate = useNavigate();
    const location = useLocation();
    const { token, refreshMatches, refreshAuthProfile, bumpNotificationEpoch } = useUser();
    const scheduleFromNav = location.state?.schedule_id;

    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [statusLoading, setStatusLoading] = useState(true);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);

    const [comfortScore, setComfortScore] = useState(3);
    const [feltSafe, setFeltSafe] = useState("");
    const [boundariesRespected, setBoundariesRespected] = useState("");
    const [feltPressured, setFeltPressured] = useState("");
    const [wouldSeeAgain, setWouldSeeAgain] = useState("");
    const [comments, setComments] = useState("");
    const [error, setError] = useState("");
    const [trustResult, setTrustResult] = useState(null);

    useEffect(() => {
        if (!scheduleFromNav || !token) {
            setStatusLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/dates/survey/status/${scheduleFromNav}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json().catch(() => ({}));
                if (!cancelled && data.submitted) setAlreadySubmitted(true);
            } catch {
                /* ignore */
            } finally {
                if (!cancelled) setStatusLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [scheduleFromNav, token]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (alreadySubmitted || submitted) return;

        if (!feltSafe || !boundariesRespected || !feltPressured || !wouldSeeAgain) {
            setError("Please answer all required safety questions.");
            return;
        }
        if (!scheduleFromNav) {
            setError("Missing date reference. Open this form from your notifications.");
            return;
        }
        if (!token) {
            setError("Please sign in again.");
            return;
        }

        setError("");
        setSubmitting(true);

        try {
            const res = await fetch(`${API_BASE_URL}/dates/survey`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    schedule_id: scheduleFromNav,
                    comfortScore,
                    feltSafe,
                    boundariesRespected,
                    feltPressured,
                    wouldSeeAgain,
                    comments: comments.trim().slice(0, 500),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || "Could not submit check-in.");
                setSubmitting(false);
                return;
            }
            setTrustResult({
                internal_delta: data.trust?.internal_delta,
                label: data.reviewed?.label,
            });
            setSubmitted(true);
            await refreshAuthProfile?.();
            refreshMatches?.();
            bumpNotificationEpoch?.();
            setTimeout(() => navigate("/chat"), 10000);
        } catch {
            setError("Network error. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const formDisabled = alreadySubmitted || submitted || statusLoading;

    return (
        <>
            <Navbar />
            <div className="faded-background d-flex flex-column justify-content-center align-items-center min-vh-100 py-5">
                <div
                    className={`login-card p-4 text-start mb-4 ${formDisabled ? "opacity-75" : ""}`}
                    style={{ width: "90%", maxWidth: "500px" }}
                    aria-busy={statusLoading}
                >
                    <form onSubmit={handleSubmit}>
                        <h5 className="section-title text-white">Post-date safety check-in</h5>
                        <p className="small text-white-50 mb-4">
                            Only safety and respect matter here — not attractiveness or money. An optional note is
                            yours if the date was rough and you want to get something off your chest.
                        </p>

                        {statusLoading && (
                            <p className="small text-white-50 mb-3">Loading…</p>
                        )}

                        {alreadySubmitted && (
                            <div className="text-center text-success fw-bold mb-3">
                                You already submitted a check-in for this date.
                            </div>
                        )}

                        {submitted && (
                            <div className="text-center mb-3">
                                <p className="text-success fw-bold mb-2">✅ Safety check-in submitted</p>
                                {trustResult && (
                                    <div
                                        className="text-start p-3"
                                        style={{ background: "#1a1a2e", borderRadius: "8px" }}
                                    >
                                        <p className="text-white fw-bold mb-2">Safety score breakdown:</p>

                                        <div className="d-flex justify-content-between text-white small mb-1">
                                            <span>
                                                Did you feel safe? <strong>{feltSafe}</strong>
                                            </span>
                                            <span
                                                style={{
                                                    color: feltSafe === "No" ? "#ff6b6b" : "#51cf66",
                                                }}
                                            >
                                                {feltSafe === "No" ? "-5" : "+2"}
                                            </span>
                                        </div>

                                        <div className="d-flex justify-content-between text-white small mb-1">
                                            <span>
                                                Boundaries respected? <strong>{boundariesRespected}</strong>
                                            </span>
                                            <span
                                                style={{
                                                    color:
                                                        boundariesRespected === "No" ? "#ff6b6b" : "#51cf66",
                                                }}
                                            >
                                                {boundariesRespected === "No" ? "-4" : "+2"}
                                            </span>
                                        </div>

                                        <div className="d-flex justify-content-between text-white small mb-1">
                                            <span>
                                                Felt pressured? <strong>{feltPressured}</strong>
                                            </span>
                                            <span
                                                style={{
                                                    color: feltPressured === "Yes" ? "#ff6b6b" : "#51cf66",
                                                }}
                                            >
                                                {feltPressured === "Yes" ? "-3" : "0"}
                                            </span>
                                        </div>

                                        <div className="d-flex justify-content-between text-white small mb-1">
                                            <span>
                                                Comfort level: <strong>{comfortScore}/5</strong>
                                            </span>
                                            <span
                                                style={{
                                                    color: comfortScore >= 4 ? "#51cf66" : "#aaa",
                                                }}
                                            >
                                                {comfortScore >= 4 ? "+1" : "0"}
                                            </span>
                                        </div>

                                        <hr style={{ borderColor: "#444" }} />

                                        <div className="d-flex justify-content-between text-white fw-bold">
                                            <span>Total impact this date</span>
                                            <span
                                                style={{
                                                    color:
                                                        trustResult.internal_delta < 0
                                                            ? "#ff6b6b"
                                                            : "#51cf66",
                                                }}
                                            >
                                                {trustResult.internal_delta > 0 ? "+" : ""}
                                                {trustResult.internal_delta}
                                            </span>
                                        </div>

                                        {trustResult.label && (
                                            <p className="text-white-50 small mt-2 mb-0 text-center">
                                                Updated rating:{" "}
                                                <strong className="text-white">{trustResult.label}</strong>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <fieldset disabled={formDisabled} className="border-0 m-0 p-0">
                            <div className="mb-4">
                                <label className="text-white">Comfort level: {comfortScore} / 5</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={comfortScore}
                                    onChange={(e) => setComfortScore(Number(e.target.value))}
                                    className="single-range mt-1"
                                />
                            </div>

                            <div className="mb-3">
                                <label className="text-white">Did you feel safe? <span className="text-danger">*</span></label>
                                <ToggleGroup options={["Yes", "No"]} value={feltSafe} onChange={setFeltSafe} />
                            </div>

                            <div className="mb-3">
                                <label className="text-white">Were your boundaries respected? <span className="text-danger">*</span></label>
                                <ToggleGroup options={["Yes", "No"]} value={boundariesRespected} onChange={setBoundariesRespected} />
                            </div>

                            <div className="mb-3">
                                <label className="text-white">Did you feel pressured? <span className="text-danger">*</span></label>
                                <ToggleGroup options={["Yes", "No"]} value={feltPressured} onChange={setFeltPressured} />
                            </div>

                            <div className="mb-3">
                                <label className="text-white">Would you meet this person again? <span className="text-danger">*</span></label>
                                <ToggleGroup options={["Yes", "No"]} value={wouldSeeAgain} onChange={setWouldSeeAgain} />
                            </div>

                            <div className="mb-4">
                                <label className="text-white">Optional note</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    maxLength={500}
                                    placeholder="Optional — for your own closure if the date didn’t go well."
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                />
                            </div>
                        </fieldset>

                        {error && <p className="text-danger small mb-3">{error}</p>}

                        <div className="text-center">
                            <button type="submit" className="submit-btn" disabled={formDisabled || submitting}>
                                {submitting ? "Submitting…" : "Submit check-in"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

export default PostDateSurvey;