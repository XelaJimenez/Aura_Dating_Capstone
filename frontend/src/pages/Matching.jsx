import Navbar from "../components/Navbar";
import AuraPlusHint from "../components/AuraPlusHint";
import ShieldRating from "../components/ShieldRating";
import MatchReportModal from "../components/MatchReportModal";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

const MIN_DATES_FOR_PUBLIC = 3;

function MatchReasonChips({ reasons }) {
    if (!Array.isArray(reasons) || reasons.length === 0) return null;
    return (
        <div className="match-card__reasons">
            <div className="match-card__reasons-title">Why you match</div>
            <div className="match-card__reasons-list">
                {reasons.map((r) => (
                    <span key={r} className="match-chip-reason">{r}</span>
                ))}
            </div>
        </div>
    );
}

function matchCardTrustLabel(user, shieldRating) {
    if (shieldRating == null) return "New User";
    if (user?.trust_label === "New User") return "";
    return user?.trust_label || "";
}

function matchCardShieldRating(user) {
    if (!user) return null;

    const num = (v) => {
        if (v == null || v === "") return null;
        const x = Number(v);
        return Number.isFinite(x) ? x : null;
    };
    const datesReviewed = num(user.trust_dates_reviewed ?? user.dates_reviewed) ?? 0;

    const fromDisplay = num(user.trust_shield_display);
    if (fromDisplay != null && fromDisplay >= 1 && fromDisplay <= 5) {
        return Math.round(fromDisplay);
    }

    const fromDirect = num(user.shield_rating ?? user.starRating);
    if (fromDirect != null && fromDirect >= 1 && fromDirect <= 5) {
        return Math.round(fromDirect);
    }

    const fromPub = num(user.public_trust_rating);
    if (fromPub != null && datesReviewed >= MIN_DATES_FOR_PUBLIC) {
        return Math.max(1, Math.min(5, Math.round(fromPub)));
    }

    return null;
}

function Pill({ label }) {
    if (!label) return null;
    return <span className="match-pill">{label}</span>;
}

function InfoRow({ icon, text }) {
    if (!text) return null;
    return (
        <div className="info-row">
            <span className="info-row__icon">{icon}</span>
            <span className="info-row__text">{text}</span>
        </div>
    );
}

function MatchCard({ user, onHeart, onReject, likesLeft, heartPending, swipeHeartOut, viewerProfile, viewerPreferences, matchRank, matchTotal }) {
    const [animating, setAnimating] = useState(null);
    const [reportOpen, setReportOpen] = useState(false);
    const outOfLikes = likesLeft !== null && likesLeft <= 0;
    const heartLocked = outOfLikes || heartPending;
    const shieldRating = matchCardShieldRating(user);
    const trustLabel = matchCardTrustLabel(user, shieldRating);

    const fire = (dir, cb) => {
        setAnimating(dir);
        setTimeout(() => { setAnimating(null); cb(); }, 0);
    };

    const cardClass = [
        "match-card",
        swipeHeartOut ? "match-card--swipe-heart" : "",
        animating === "reject" ? "match-card--swipe-reject" : "",
    ].filter(Boolean).join(" ");

    return (
        <>
        <div className={cardClass}>
            <div className="match-card__photo-wrap">
                <img src={user.image} alt={user.name} className="match-card__photo" />
                <div className="match-card__gradient" />
                <div className="match-card__photo-info">
                    <div className="match-card__name">
                        {user.name}{user.age ? `, ${user.age}` : ""}
                    </div>
                    {user.location && (
                        <div className="match-card__location">📍 {user.location}</div>
                    )}
                </div>
                <div className="match-card__rating-badge match-card__rating-badge--corner" title={trustLabel}>
                    <ShieldRating variant="onDark" rating={shieldRating} />
                    <span className="match-card__trust-label">{trustLabel}</span>
                </div>
            </div>

            <div className="match-card__body">
                <div className="match-card__pills">
                    <Pill label={user.gender} />
                    {user.age && <Pill label={`${user.age} yrs`} />}
                    {user.height && <Pill label={user.height} />}
                    {user.personality_name && <Pill label={user.personality_name} />}
                </div>

                <div className="match-card__grid">
                    <InfoRow icon="🎯" text={user.dating_goals_name} />
                    <InfoRow icon="🙏" text={user.religion_name} />
                    <InfoRow icon="⚡" text={user.activity_name && `Activity: ${user.activity_name}`} />
                    <InfoRow icon="👶" text={user.children_name} />
                    <InfoRow icon="🗳️" text={user.political_name} />
                    <InfoRow icon="🎵" text={user.music_name} />
                    <InfoRow icon="🚬" text={user.smoking_name && `Smoking: ${user.smoking_name}`} />
                    <InfoRow icon="🍷" text={user.drinking_name && `Drinking: ${user.drinking_name}`} />
                    <InfoRow icon="🥗" text={user.diet_name} />
                    <InfoRow icon="👨‍👩‍👧" text={user.family_oriented_name && `Family: ${user.family_oriented_name}`} />
                    <InfoRow icon="🎓" text={user.education_name} />
                </div>

                {user.bio && (
                    <div className="match-card__bio">"{user.bio}"</div>
                )}

                <MatchReasonChips reasons={user.match_reasons} />

                {user.score !== undefined && (
                    <div className="match-card__score">Match score: {user.score}</div>
                )}
            </div>

            <div className="match-card__actions">
                <button
                    type="button"
                    className="btn-reject"
                    disabled={heartPending}
                    onClick={() => { if (!heartPending) fire("reject", onReject); }}
                >✕</button>

                <button
                    className={`btn-heart${heartLocked ? " btn-heart--disabled" : ""}`}
                    type="button"
                    onClick={() => { if (!heartLocked) onHeart(); }}
                    disabled={heartLocked}
                    title={outOfLikes ? "Daily like limit reached" : heartPending ? "Sending…" : "Like"}
                >❤️</button>
            </div>

            <div className="match-card__report">
                <button type="button" className="btn-match-report" onClick={() => setReportOpen(true)}>
                    Why this match?
                </button>
            </div>
        </div>
        <MatchReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            match={user}
            viewerProfile={viewerProfile}
            viewerPreferences={viewerPreferences}
            matchRank={matchRank}
            matchTotal={matchTotal}
        />
        </>
    );
}

function LikedPortal({ likedUsers, onOpenChat }) {
    if (likedUsers.length === 0) return null;
    return (
        <div className="liked-portal">
            <div className="liked-portal__heading">
                ❤️ Liked — {likedUsers.length} {likedUsers.length === 1 ? "person" : "people"}
            </div>
            {likedUsers.map((u, i) => (
                <div key={i} className="liked-portal__item" onClick={() => onOpenChat(u)}>
                    <img src={u.image} alt={u.name} className="liked-portal__avatar" />
                    <div className="liked-portal__info">
                        <div className="liked-portal__name">{u.name}</div>
                        <div className="liked-portal__meta">
                            {[u.location, u.age && `${u.age} yrs`, u.gender].filter(Boolean).join(" · ")}
                        </div>
                    </div>
                    <div className="liked-portal__cta">Message →</div>
                </div>
            ))}
        </div>
    );
}

export default function Matching() {
    const {
        matches, matchesLoading, matchesError, currentUser, token, likedUsers, addLikedUser,
        likesLeft, setLikesLeft, tierLimit, profile, preferences, refreshMatches,
    } = useUser();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showItsMatch, setShowItsMatch] = useState(false);
    const [itsMatchPartner, setItsMatchPartner] = useState(null);
    const [heartPending, setHeartPending] = useState(false);
    const [likeActionError, setLikeActionError] = useState("");
    const [likeLimitAuraPlus, setLikeLimitAuraPlus] = useState(false);
    const [swipeHeartOut, setSwipeHeartOut] = useState(false);
    const [rejectError, setRejectError] = useState("");
    const navigate = useNavigate();

    useEffect(() => { if (!currentUser) navigate("/"); }, [currentUser, navigate]);
    useEffect(() => { setCurrentIndex(0); }, [matches]);
    useEffect(() => {
        if (!currentUser?.user_id || !token) return;
        if (currentIndex > 0 && currentIndex >= matches.length && matches.length > 0) {
            refreshMatches({ silent: true });
        }
    }, [currentIndex, matches.length, currentUser?.user_id, token, refreshMatches]);
    useEffect(() => {
        setLikeActionError("");
        setLikeLimitAuraPlus(false);
        setRejectError("");
    }, [currentIndex]);

    const handleHeart = () => {
        const liked = matches[currentIndex];
        if (!liked || !currentUser || heartPending) return;
        if (likesLeft !== null && likesLeft <= 0) return;
        setHeartPending(true);
        setLikeActionError("");

        fetch(`${API_BASE_URL}/matches/${currentUser.user_id}/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ liked_user_id: liked.user_id }),
        })
            .then(async (res) => {
                let data = {};
                try {
                    data = await res.json();
                } catch {
                    data = {};
                }
                if (res.status === 429) {
                    setLikeActionError(data.error || "Daily like limit reached.");
                    setLikeLimitAuraPlus(data.upgrade_hint === "aura_plus");
                    if (data.likes_left !== undefined) setLikesLeft(data.likes_left);
                    setHeartPending(false);
                    return;
                }
                const accepted = res.ok || res.status === 409;
                if (!accepted) {
                    setLikeActionError(data.error || "Could not send like.");
                    setHeartPending(false);
                    return;
                }
                if (data.likes_left !== undefined) setLikesLeft(data.likes_left);
                setSwipeHeartOut(true);
                setTimeout(() => {
                    addLikedUser(liked);
                    if (data.match_created) {
                        setItsMatchPartner({
                            ...liked,
                            match_id: data.match_id != null ? data.match_id : liked.match_id,
                        });
                        setShowItsMatch(true);
                    }
                    setCurrentIndex((prev) => prev + 1);
                    setSwipeHeartOut(false);
                    setHeartPending(false);
                }, 0);
            })
            .catch(() => {
                setLikeActionError("Could not connect to server.");
                setHeartPending(false);
            });
    };

    const handleReject = () => {
        const rejected = matches[currentIndex];
        if (!rejected || !currentUser || !token) return;
        setRejectError("");
        fetch(`${API_BASE_URL}/matches/${currentUser.user_id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ rejected_user_id: rejected.user_id }),
        })
            .then(async (res) => {
                let data = {};
                try {
                    data = await res.json();
                } catch {
                    data = {};
                }
                if (!res.ok) {
                    setRejectError(data.error || "Could not record pass.");
                    return;
                }
                setCurrentIndex((prev) => prev + 1);
            })
            .catch(() => {
                setRejectError("Could not connect to server.");
            });
    };
    const handleOpenChat = (user) => navigate("/chat", { state: { selectedMatch: user } });

    const showIdleAuraPlus =
        likesLeft === 0
        && tierLimit === 3
        && currentIndex < matches.length
        && matches.length > 0
        && !likeActionError;

    if (matchesLoading) return (
        <>
            <Navbar />
            <div className="faded-background d-flex justify-content-center align-items-center min-vh-100 min-vw-100">
                <p className="text-white">Finding your matches...</p>
            </div>
        </>
    );

    if (matchesError) return (
        <>
            <Navbar />
            <div className="faded-background d-flex justify-content-center align-items-center min-vh-100 min-vw-100">
                <p className="text-danger">{matchesError}</p>
            </div>
        </>
    );

    const allSwiped = currentIndex >= matches.length;

    return (
        <>
            <Navbar />

            {showItsMatch && itsMatchPartner && (
                <div className="match-overlay match-overlay--celebrate" role="dialog" aria-modal="true" aria-labelledby="its-a-match-title">
                    <div className="match-overlay__glow" aria-hidden />
                    <div className="match-overlay__hearts" aria-hidden>❤️</div>
                    <h2 id="its-a-match-title" className="match-overlay__title">It&apos;s a Match!</h2>
                    <p className="match-overlay__sub">
                        You and <strong className="match-overlay__name-strong">{itsMatchPartner.first_name || itsMatchPartner.name}</strong>
                    </p>
                    <div className="match-overlay__photo-shell">
                        <img src={itsMatchPartner.image} alt="" className="match-overlay__photo" />
                    </div>
                    <div className="match-overlay__actions">
                        <button
                            type="button"
                            className="match-overlay__btn match-overlay__btn--primary"
                            onClick={() => {
                                setShowItsMatch(false);
                                const m = itsMatchPartner;
                                setItsMatchPartner(null);
                                navigate("/chat", {
                                    state: {
                                        selectedMatch: {
                                            match_id: m.match_id,
                                            user_id: m.user_id,
                                            name: m.name,
                                            image: m.image,
                                        },
                                    },
                                });
                            }}
                        >
                            Say hi
                        </button>
                        <button
                            type="button"
                            className="match-overlay__btn match-overlay__btn--ghost"
                            onClick={() => {
                                setShowItsMatch(false);
                                setItsMatchPartner(null);
                            }}
                        >
                            Keep swiping
                        </button>
                    </div>
                </div>
            )}

            <div className="faded-background min-vh-100 min-vw-100 match-page">
                {(likesLeft !== null || (!allSwiped && matches.length > 0)) && (
                    <div className="match-counter">
                        {!allSwiped && matches.length > 0 && (
                            <span className="match-counter__progress">{currentIndex + 1} of {matches.length}</span>
                        )}
                        {likesLeft !== null && (
                            <span className="match-counter__likes">❤️ {likesLeft} of {tierLimit} like{tierLimit !== 1 ? "s" : ""} left today</span>
                        )}
                    </div>
                )}

                {showIdleAuraPlus && <AuraPlusHint className="aura-plus-hint--quiet" />}

                {(likeActionError || rejectError) && (
                    <div className="match-like-alert" role="alert">{likeActionError || rejectError}</div>
                )}
                {likeLimitAuraPlus && <AuraPlusHint />}

                {allSwiped || matches.length === 0 ? (
                    <div className="match-empty">
                        <div className="match-empty__icon">✨</div>
                        <div className="match-empty__title">Check back tomorrow — new matches are on the way.</div>
                    </div>
                ) : (
                    <MatchCard
                        key={matches[currentIndex].user_id}
                        user={matches[currentIndex]}
                        onHeart={handleHeart}
                        onReject={handleReject}
                        likesLeft={likesLeft}
                        heartPending={heartPending}
                        swipeHeartOut={swipeHeartOut}
                        viewerProfile={profile}
                        viewerPreferences={preferences}
                        matchRank={currentIndex + 1}
                        matchTotal={matches.length}
                    />
                )}

                <LikedPortal likedUsers={likedUsers} onOpenChat={handleOpenChat} />
            </div>
        </>
    );
}
