import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

const APPEAL_OPTIONS = [
    { key: "mismatch", label: "This doesn’t reflect what happened on the date" },
    { key: "context", label: "Important context was missing" },
    { key: "misunderstanding", label: "This was a misunderstanding" },
    { key: "inaccurate", label: "The feedback was inaccurate" },
];

const STORAGE_KEY = "aura_appeal_resolution";

export default function Appeal() {
    const { token, currentUser, refreshAuthProfile, bumpNotificationEpoch } = useUser();
    const navigate = useNavigate();
    const [eligible, setEligible] = useState(null);
    const [reason, setReason] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingAppeals, setLoadingAppeals] = useState(true);
    const [justSubmitted, setJustSubmitted] = useState(() => {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        if (!currentUser) {
            navigate("/");
            return;
        }
        if (!token) return;

        let cancelled = false;
        (async () => {
            try {
                const [elRes, listRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/appeals/eligibility`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`${API_BASE_URL}/appeals/mine`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);
                const elData = await elRes.json().catch(() => ({}));
                const listData = await listRes.json().catch(() => ({}));
                if (cancelled) return;
                setEligible(elData.eligible === true);
                const appeals = listData.appeals || [];
                if (!sessionStorage.getItem(STORAGE_KEY) && appeals[0]?.status === "resolved") {
                    const a = appeals[0];
                    setJustSubmitted({
                        summary: a.reviewer_note,
                        outcome: a.outcome,
                        banned: a.outcome === "auto_banned",
                    });
                }
            } catch {
                if (!cancelled) setEligible(false);
            } finally {
                if (!cancelled) setLoadingAppeals(false);
            }
        })();
        return () => { cancelled = true; };
    }, [currentUser, token, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!reason) {
            setError("Choose the option that best describes your situation.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/appeals`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    reason,
                    note: note.trim() || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || "Could not submit appeal.");
                setSubmitting(false);
                return;
            }
            const resPayload = data.resolution || { summary: data.message, outcome: null, banned: false };
            setJustSubmitted(resPayload);
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(resPayload));
            } catch {
                /* ignore */
            }
            setNote("");
            setReason("");
            await refreshAuthProfile?.();
            bumpNotificationEpoch?.();
        } catch {
            setError("Network error.");
        } finally {
            setSubmitting(false);
        }
    };

    const showDone = Boolean(justSubmitted);
    const clearDoneAndRetry = () => {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
        setJustSubmitted(null);
    };

    return (
        <>
            <Navbar />
            <div className="faded-background min-vh-100 min-vw-100 d-flex justify-content-center pt-4 pb-5 px-3">
                <div className="login-card p-4" style={{ maxWidth: "480px", width: "100%" }}>
                    <h4 className="section-title mb-3">Trust appeal</h4>

                    {loadingAppeals && <p className="small appeal-form-text">Loading…</p>}

                    {!loadingAppeals && showDone && (
                        <div className="appeal-done">
                            <p className="fw-semibold text-success mb-2">Your appeal was submitted and processed.</p>
                            <p className="small appeal-form-text mb-0">
                                {justSubmitted?.summary || "Thank you — your appeal is on record."}
                            </p>
                            {justSubmitted?.banned && (
                                <p className="small text-danger mt-3 mb-0">
                                    This account has been closed. You will be signed out if you try to use the app.
                                </p>
                            )}
                            {justSubmitted?.outcome === "auto_approved" && (
                                <p className="small appeal-form-text mt-2 mb-0">
                                    Public trust of 4 or higher: appeal treated favorably with only a small score change.
                                </p>
                            )}
                            {justSubmitted?.outcome === "auto_penalty" && (
                                <p className="small appeal-form-text mt-2 mb-0">
                                    Public trust between 2 and 4: a larger automated reduction applies (no admin review).
                                </p>
                            )}
                            {eligible && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary mt-3"
                                    onClick={clearDoneAndRetry}
                                >
                                    Submit another appeal
                                </button>
                            )}
                        </div>
                    )}

                    {!loadingAppeals && !showDone && eligible === false && (
                        <p className="small appeal-form-text">
                            Appeals are not available right now. They open when the system has applied a moderation
                            action to your account, or within 90 days of a safety-related date check-in about you.
                        </p>
                    )}

                    {!loadingAppeals && !showDone && eligible === true && (
                        <form className="appeal-form" onSubmit={handleSubmit}>
                            <p className="small mb-4 appeal-form-text">
                                Choose the statement that fits. You can add a short optional note.
                            </p>
                            <div className="mb-3">
                                <div className="form-label mb-2">What best describes your situation?</div>
                                <div className="d-flex flex-column gap-2">
                                    {APPEAL_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            className={`btn text-start appeal-reason-btn ${
                                                reason === opt.key ? "btn-danger" : "btn-outline-dark"
                                            }`}
                                            onClick={() => setReason(opt.key)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label small appeal-form-text">Optional note (max 200 characters)</label>
                                <textarea
                                    className="form-control form-control-sm"
                                    rows={2}
                                    maxLength={200}
                                    placeholder="Only if you want to add a little more detail."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>
                            {error && <p className="text-danger small">{error}</p>}
                            <button type="submit" className="submit-btn w-100" disabled={submitting || !reason}>
                                {submitting ? "Submitting…" : "Submit appeal"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </>
    );
}
