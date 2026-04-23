import Navbar from "../components/Navbar";
import PartnerGenderPrefs from "../components/PartnerGenderPrefs";
import ShieldRating from "../components/ShieldRating";
import { useUser } from "../context/UserContext";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { buildProfileSaveRequestBody } from "../utils/profileSaveBody";

function initialsFromName(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

function nameForInitials(profile, currentUser) {
    const n = profile.name?.trim();
    if (n) return n;
    const fromContext = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ").trim();
    if (fromContext) return fromContext;
    try {
        const raw = localStorage.getItem("user");
        if (!raw) return "";
        const u = JSON.parse(raw);
        const fromLs = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
        if (fromLs) return fromLs;
        const em = u.email;
        if (typeof em === "string" && em.includes("@")) return em.split("@")[0] || "";
    } catch {
        return "";
    }
    return "";
}

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

function Profile() {
    const {
        profile,
        setProfile,
        preferences,
        setPreferences,
        currentUser,
        token,
        refreshMatches,
        accountProfileLoaded,
        syncSessionFromAuthUser,
    } = useUser();
    const [saveError, setSaveError] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [appealEligible, setAppealEligible] = useState(null);
    const pendingPhotoFileRef = useRef(null);
    const lastBlobUrlRef = useRef(null);

    const updateProfile = (field, value) => setProfile((prev) => ({ ...prev, [field]: value }));
    const updatePref = (field, value) => setPreferences((prev) => ({ ...prev, [field]: value }));

    const td = profile.trustDisplay;
    const num = (v) => {
        if (v == null || v === "") return null;
        const x = Number(v);
        return Number.isFinite(x) ? x : null;
    };
    const internalToShield = (internalScore) => {
        const n = num(internalScore);
        if (n == null) return null;
        return Math.max(1, Math.min(5, Math.round(n / 20)));
    };
    const fromTrustDisplay = num(td?.shield_count);
    const shieldCount =
        fromTrustDisplay != null
            ? Math.max(1, Math.min(5, Math.round(fromTrustDisplay)))
            : internalToShield(profile.trustScore);
    const trustLabel = shieldCount == null
        ? "No score"
        : td?.label && td.label !== "New User"
            ? td.label
            : "";

    const inchesToDisplay = (inches) => {
        const ft = Math.floor(inches / 12);
        const inch = inches % 12;
        return `${ft}'${inch}"`;
    };

    const pic = profile.profilePic;
    const showPhoto = Boolean(
        pic && (pic.startsWith("http") || pic.startsWith("blob:") || pic.startsWith("data:") || pic.startsWith("/"))
    );

    const displayNameForInitials = nameForInitials(profile, currentUser);

    const handleImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (lastBlobUrlRef.current) {
            URL.revokeObjectURL(lastBlobUrlRef.current);
            lastBlobUrlRef.current = null;
        }
        pendingPhotoFileRef.current = file;
        const url = URL.createObjectURL(file);
        lastBlobUrlRef.current = url;
        updateProfile("profilePic", url);
        setSaveError(null);
    };

    useEffect(() => () => {
        if (lastBlobUrlRef.current) URL.revokeObjectURL(lastBlobUrlRef.current);
    }, []);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        fetch(`${API_BASE_URL}/appeals/eligibility`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (!cancelled) setAppealEligible(data.eligible === true);
            })
            .catch(() => {
                if (!cancelled) setAppealEligible(false);
            });
        return () => { cancelled = true; };
    }, [token]);

    const handleSave = async () => {
        setSaveError(null);
        setSaveSuccess(false);

        if (!currentUser || !token) {
            setSaveError("You must be logged in to save.");
            return;
        }

        const locVal = profile.location || "";
        if (locVal.trim() && !locVal.includes(",")) {
            setSaveError("Please enter your location as City, State (e.g. Chicago, IL).");
            return;
        }

        try {
            if (pendingPhotoFileRef.current) {
                const dataUrl = await readFileAsDataUrl(pendingPhotoFileRef.current);
                const photoRes = await fetch(`${API_BASE_URL}/profile/photo`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ photo_url: dataUrl }),
                });
                const photoData = await photoRes.json();
                if (!photoRes.ok) {
                    setSaveError(photoData.error || "Failed to save photo.");
                    return;
                }
                const savedUrl = photoData.photo_url;
                if (lastBlobUrlRef.current) {
                    URL.revokeObjectURL(lastBlobUrlRef.current);
                    lastBlobUrlRef.current = null;
                }
                pendingPhotoFileRef.current = null;
                updateProfile("profilePic", savedUrl);
            }

            const [profileRes, prefRes] = await Promise.all([
                fetch(`${API_BASE_URL}/profile/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify(buildProfileSaveRequestBody(profile)),
                }),
                fetch(`${API_BASE_URL}/profile/preferences`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        genderPref:     preferences.genderPref,
                        genderPrefs:    preferences.genderPrefs ?? [],
                        minAge:         preferences.minAge,
                        maxAge:         preferences.maxAge,
                        minHeight:      preferences.minHeight,
                        maxHeight:      preferences.maxHeight,
                        religionPref:   preferences.religionPref,
                        ethnicityPref:  preferences.ethnicityPref,
                        politicalPref:  preferences.politicalPref,
                        childrenPref:   preferences.childrenPref,
                        datingGoalPref: preferences.datingGoalPref,
                        activityPref:   preferences.activityPref,
                        familyOrientedPref: preferences.familyOrientedPref,
                    }),
                }),
            ]);

            const [profileData, prefData] = await Promise.all([
                profileRes.json().catch(() => ({})),
                prefRes.json().catch(() => ({})),
            ]);
            if (!profileRes.ok) {
                setSaveError(profileData.error || "Failed to save profile.");
                return;
            }
            if (!prefRes.ok) {
                setSaveError(prefData.error || "Failed to save preferences.");
                return;
            }

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            await refreshMatches();
            const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                if (meData?.user) syncSessionFromAuthUser(meData.user);
            }
        } catch {
            setSaveError("Could not connect to server. Please try again.");
        }
    };

    if (token && !accountProfileLoaded) {
        return (
            <>
                <Navbar />
                <div className="container d-flex justify-content-center align-items-center text-center faded-background min-vh-100 min-vw-100">
                    <div className="profile-loading">Loading profile…</div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="container d-flex justify-content-center align-items-center text-center faded-background min-vh-100 min-vw-100">
                <div className="login-card p-4 text-center mb-4">

                    <div className="bg-white profile-photo-wrap profile-polaroid">
                        <div
                            className="profile-avatar-shell"
                            onClick={() => document.getElementById("picUpload").click()}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    document.getElementById("picUpload").click();
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            {showPhoto ? (
                                <img
                                    src={pic}
                                    className="profile-pic"
                                    alt=""
                                />
                            ) : (
                                <div className="profile-avatar-initials" aria-hidden="true">
                                    {initialsFromName(displayNameForInitials)}
                                </div>
                            )}
                        </div>
                        <input
                            id="picUpload"
                            type="file"
                            accept="image/*"
                            className="profile-pic-input"
                            onChange={handleImageChange}
                        />
                        <div className="text-muted small mb-2 bi-camera profile-change-photo" onClick={() => document.getElementById("picUpload").click()}>
                            -Change Photo
                        </div>
                        <div className="pb-2 text-center profile-trust-panel">
                            <div className="small text-white-50 mb-1">Safety trust</div>
                            <ShieldRating rating={shieldCount} />
                            <div className="small text-white mt-1 fw-semibold">
                                {trustLabel}
                            </div>
                            {td?.dates_reviewed != null && (
                                <div className="small text-white-50">
                                    {td.dates_reviewed} date{td.dates_reviewed === 1 ? "" : "s"} reviewed
                                </div>
                            )}
                            {td?.show_numeric && td?.public_trust_rating != null && (
                                <div className="small text-white-50">
                                    {td.public_trust_rating.toFixed(1)} · Safety-based rating
                                </div>
                            )}
                            {td?.show_numeric && (
                                <div className="small text-white-50 mt-1 profile-trust-footnote">
                                    Shields reflect a rolling average; one difficult date may not change the count.
                                </div>
                            )}
                        </div>
                        <div className="profile-polaroid-title">Profile</div>
                    </div>

                    <div className="profile-appeal-card mt-3 mb-3">
                        <div className="small text-muted">
                            If a date check-in affects your score, we&apos;ll notify you in the bell.
                        </div>
                        <div className="mt-2">
                            <Link to="/appeals" className="btn btn-outline-danger btn-sm">
                                Submit trust appeal
                            </Link>
                        </div>
                        <div className="small text-muted mt-2">
                            {appealEligible === true ? "You are currently eligible to submit an appeal." : "Appeals are available when eligible."}
                        </div>
                    </div>

                    <h3 className="mt-3">My Profile</h3>

                    <div className="mb-3 text-start">
                        <label>Name</label>
                        <input className="form-control" value={profile.name} onChange={(e) => updateProfile("name", e.target.value)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Location <span className="text-muted location-hint">(City, State — e.g. Chicago, IL)</span></label>
                        <input
                            className="form-control"
                            value={profile.location}
                            placeholder="Chicago, IL"
                            onChange={(e) => updateProfile("location", e.target.value)}
                        />
                    </div>

                    <div className="mb-4 text-start">
                        <label>Gender</label>
                        <ToggleGroup options={["Male", "Female", "Non-binary"]} value={profile.gender} onChange={(v) => updateProfile("gender", v)} />
                    </div>

                    <h5 className="section-title">Identity &amp; Background</h5>

                    <div className="mb-3 text-start">
                        <label>Religion</label>
                        <select className="form-select" value={profile.religion} onChange={(e) => updateProfile("religion", e.target.value)}>
                            <option value="">Select...</option>
                            <option>Atheist</option>
                            <option>Agnostic</option>
                            <option>Buddhist</option>
                            <option>Catholic</option>
                            <option>Christian</option>
                            <option>Hindu</option>
                            <option>Jewish</option>
                            <option>Mormon</option>
                            <option>Muslim</option>
                            <option>Spiritual (non-religious)</option>
                            <option>Other</option>
                            <option>Prefer not to say</option>
                        </select>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Ethnicity</label>
                        <select className="form-select" value={profile.ethnicity} onChange={(e) => updateProfile("ethnicity", e.target.value)}>
                            <option value="">Select...</option>
                            <option>Asian</option>
                            <option>Black / African American</option>
                            <option>Hispanic / Latino</option>
                            <option>Middle Eastern</option>
                            <option>Native American</option>
                            <option>Pacific Islander</option>
                            <option>White / Caucasian</option>
                            <option>Multiracial</option>
                            <option>Other</option>
                            <option>Prefer not to say</option>
                        </select>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Education</label>
                        <select className="form-select" value={profile.education} onChange={(e) => updateProfile("education", e.target.value)}>
                            <option value="">Select...</option>
                            <option>High School</option>
                            <option>Some College</option>
                            <option>Associate's Degree</option>
                            <option>Bachelor's Degree</option>
                            <option>Master's Degree</option>
                            <option>Doctorate / PhD</option>
                            <option>Trade</option>
                        </select>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Your Height: {inchesToDisplay(profile.height)}</label>
                        <input
                            type="range"
                            min="48"
                            max="96"
                            value={profile.height}
                            onChange={(e) => updateProfile("height", Number(e.target.value))}
                            className="single-range mt-1"
                        />
                    </div>

                    <div className="mb-4 text-start">
                        <label>Family-Oriented?</label>
                        <ToggleGroup options={["Yes", "No", "No preference"]} value={profile.familyOriented} onChange={(v) => updateProfile("familyOriented", v)} />
                    </div>

                    <h5 className="section-title">Lifestyle &amp; Habits</h5>

                    <div className="mb-3 text-start">
                        <label>Do you smoke?</label>
                        <ToggleGroup options={["Yes", "No", "Occasionally"]} value={profile.smoker} onChange={(v) => updateProfile("smoker", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Do you drink?</label>
                        <ToggleGroup options={["Yes", "No", "Social"]} value={profile.drinker} onChange={(v) => updateProfile("drinker", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Do you drink coffee?</label>
                        <ToggleGroup options={["Yes", "No"]} value={profile.coffeeDrinker} onChange={(v) => updateProfile("coffeeDrinker", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Diet</label>
                        <ToggleGroup options={["Omnivore", "Vegetarian", "Vegan", "Other"]} value={profile.diet} onChange={(v) => updateProfile("diet", v)} />
                    </div>

                    <div className="mb-4 text-start">
                        <label>Activity Level</label>
                        <ToggleGroup options={["Low", "Medium", "High"]} value={profile.activityLevel} onChange={(v) => updateProfile("activityLevel", v)} />
                    </div>

                    <h5 className="section-title">Interests &amp; Hobbies</h5>

                    <div className="mb-3 text-start">
                        <label>Music Preference</label>
                        <select className="form-select" value={profile.musicPref} onChange={(e) => updateProfile("musicPref", e.target.value)}>
                            <option value="">Select...</option>
                            <option>Pop</option>
                            <option>Hip-Hop / Rap</option>
                            <option>R&amp;B / Soul</option>
                            <option>Rock</option>
                            <option>Country</option>
                            <option>Electronic / EDM</option>
                            <option>Jazz / Blues</option>
                            <option>Classical</option>
                            <option>Latin</option>
                            <option>Everything</option>
                            <option>Other</option>
                        </select>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Are you a gamer?</label>
                        <ToggleGroup options={["Yes", "No", "Casual"]} value={profile.gamer} onChange={(v) => updateProfile("gamer", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Are you a reader?</label>
                        <ToggleGroup options={["Yes", "No", "Occasionally"]} value={profile.reader} onChange={(v) => updateProfile("reader", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Do you like to travel?</label>
                        <ToggleGroup options={["Love it", "Occasionally", "Not really"]} value={profile.travel} onChange={(v) => updateProfile("travel", v)} />
                    </div>

                    <div className="mb-4 text-start">
                        <label>Animals / Pets</label>
                        <select className="form-select" value={profile.pets} onChange={(e) => updateProfile("pets", e.target.value)}>
                            <option value="">Select...</option>
                            <option>Love animals</option>
                            <option>Have pets</option>
                            <option>Allergic</option>
                            <option>Not a fan</option>
                            <option>Neutral</option>
                        </select>
                    </div>

                    <h5 className="section-title">Personality &amp; Values</h5>

                    <div className="mb-3 text-start">
                        <label>Personality Type</label>
                        <ToggleGroup options={["Introvert", "Extrovert", "Ambivert"]} value={profile.personality} onChange={(v) => updateProfile("personality", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Dating Goals</label>
                        <ToggleGroup options={["Casual", "Serious", "Long-term"]} value={profile.datingGoal} onChange={(v) => updateProfile("datingGoal", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>What's your political standing?</label>
                        <select className="form-select" value={profile.politicalStanding} onChange={(e) => updateProfile("politicalStanding", e.target.value)}>
                            <option value="">Select...</option>
                            <option>Very Liberal</option>
                            <option>Liberal</option>
                            <option>Moderate</option>
                            <option>Conservative</option>
                            <option>Very Conservative</option>
                            <option>Apolitical</option>
                            <option>Prefer not to say</option>
                        </select>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Bio</label>
                        <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Tell us more about yourself..."
                            value={profile.bio}
                            onChange={(e) => updateProfile("bio", e.target.value)}
                        />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Do you have or want children?</label>
                        <ToggleGroup options={["Have kids", "Want kids", "Don't want kids", "Open", "No preference"]} value={profile.children} onChange={(v) => updateProfile("children", v)} />
                    </div>

                    <div className="mb-4 text-start">
                        <label>Astrology Sign (optional)</label>
                        <select className="form-select" value={profile.astrology} onChange={(e) => updateProfile("astrology", e.target.value)}>
                            <option value="">Select...</option>
                            <option>Aries</option>
                            <option>Taurus</option>
                            <option>Gemini</option>
                            <option>Cancer</option>
                            <option>Leo</option>
                            <option>Virgo</option>
                            <option>Libra</option>
                            <option>Scorpio</option>
                            <option>Sagittarius</option>
                            <option>Capricorn</option>
                            <option>Aquarius</option>
                            <option>Pisces</option>
                        </select>
                    </div>

                    <h5 className="section-title">Partner Preferences</h5>

                    <div className="mb-3 text-start">
                        <label>Partner gender (pick one or more types, or Open to all genders)</label>
                        <PartnerGenderPrefs
                            genderPrefs={preferences.genderPrefs}
                            onChange={(next) => setPreferences((prev) => ({
                                ...prev,
                                genderPrefs: next,
                                genderPref: next.length === 0 ? "No preference" : next.length === 1 ? next[0] : "Multiple",
                            }))}
                        />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Age Range: {preferences.minAge} – {preferences.maxAge}</label>
                        <div className="range-wrap">
                            <input type="range" min="18" max="100" value={preferences.minAge}
                                   onChange={(e) => updatePref("minAge", Math.min(Number(e.target.value), preferences.maxAge - 1))}
                                   className="dual-range dual-range-min" />
                            <input type="range" min="18" max="100" value={preferences.maxAge}
                                   onChange={(e) => updatePref("maxAge", Math.max(Number(e.target.value), Number(preferences.minAge) + 1))}
                                   className="dual-range" />
                        </div>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Height Range: {inchesToDisplay(preferences.minHeight)} – {inchesToDisplay(preferences.maxHeight)}</label>
                        <div className="range-wrap">
                            <input type="range" min="48" max="96" value={preferences.minHeight}
                                   onChange={(e) => updatePref("minHeight", Math.min(Number(e.target.value), preferences.maxHeight - 1))}
                                   className="dual-range dual-range-min" />
                            <input type="range" min="48" max="96" value={preferences.maxHeight}
                                   onChange={(e) => updatePref("maxHeight", Math.max(Number(e.target.value), Number(preferences.minHeight) + 1))}
                                   className="dual-range" />
                        </div>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Religion Preference</label>
                        <select className="form-select" value={preferences.religionPref} onChange={(e) => updatePref("religionPref", e.target.value)}>
                            <option value="">Open to all religions</option>
                            <option>Atheist</option>
                            <option>Agnostic</option>
                            <option>Buddhist</option>
                            <option>Catholic</option>
                            <option>Christian</option>
                            <option>Hindu</option>
                            <option>Jewish</option>
                            <option>Mormon</option>
                            <option>Muslim</option>
                            <option>Spiritual (non-religious)</option>
                        </select>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Ethnicity Preference</label>
                        <select className="form-select" value={preferences.ethnicityPref} onChange={(e) => updatePref("ethnicityPref", e.target.value)}>
                            <option value="">Open to all ethnicities</option>
                            <option>Asian</option>
                            <option>Black / African American</option>
                            <option>Hispanic / Latino</option>
                            <option>Middle Eastern</option>
                            <option>Native American</option>
                            <option>Pacific Islander</option>
                            <option>White / Caucasian</option>
                            <option>Multiracial</option>
                        </select>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Political Preference</label>
                        <select className="form-select" value={preferences.politicalPref} onChange={(e) => updatePref("politicalPref", e.target.value)}>
                            <option value="">Open to all political leanings</option>
                            <option>Very Liberal</option>
                            <option>Liberal</option>
                            <option>Moderate</option>
                            <option>Conservative</option>
                            <option>Very Conservative</option>
                            <option>Apolitical</option>
                        </select>
                    </div>

                    <div className="mb-3 text-start">
                        <label>Children Preference</label>
                        <ToggleGroup options={["Have kids", "Want kids", "Don't want kids", "Open", "No preference"]} value={preferences.childrenPref} onChange={(v) => updatePref("childrenPref", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Activity Level Preference</label>
                        <ToggleGroup options={["Low", "Medium", "High", "No preference"]} value={preferences.activityPref} onChange={(v) => updatePref("activityPref", v)} />
                    </div>

                    <div className="mb-3 text-start">
                        <label>Family-oriented preference</label>
                        <ToggleGroup options={["Yes", "No", "No preference"]} value={preferences.familyOrientedPref} onChange={(v) => updatePref("familyOrientedPref", v)} />
                    </div>

                    <div className="mb-4 text-start">
                        <label>Dating Goals Preference</label>
                        <ToggleGroup options={["Casual", "Serious", "Long-term", "No preference"]} value={preferences.datingGoalPref} onChange={(v) => updatePref("datingGoalPref", v)} />
                    </div>

                    {saveError && (
                        <div className="alert alert-danger py-2 text-start alert-sm">
                            {saveError}
                        </div>
                    )}

                    {saveSuccess && (
                        <div className="alert alert-success py-2 text-start alert-sm">
                            Profile saved successfully!
                        </div>
                    )}

                    <div>
                        <Link to="/aura-plus" className="btn btn-danger me-2 mb-2">
                            Get Aura +
                        </Link>
                    </div>
                    <div>
                        <button className="btn btn-outline-danger me-2" onClick={handleSave}>
                            Save
                        </button>
                    </div>

                </div>
            </div>
        </>
    );
}

export default Profile;