import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useState } from "react";
import { API_BASE_URL } from "../config/api";
import { buildProfileSaveRequestBody } from "../utils/profileSaveBody";

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

function Questionnaire() {
    const navigate = useNavigate();
    const { profile, setProfile, token, currentUser, refreshAuthProfile } = useUser();
    const update = (field, value) => setProfile((prev) => ({ ...prev, [field]: value }));

    const inchesToDisplay = (inches) => {
        const ft = Math.floor(inches / 12);
        const inch = inches % 12;
        return `${ft}'${inch}"`;
    };

    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!profile.religion || !profile.datingGoal || !profile.personality || !profile.gender) {
            setError("Please fill in all required fields.");
            return;
        }
        if (!token || !currentUser?.user_id) {
            setError("You must be logged in to continue.");
            return;
        }
        setError("");
        try {
            const profileRes = await fetch(`${API_BASE_URL}/profile/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(buildProfileSaveRequestBody(profile)),
            });
            const profileData = await profileRes.json().catch(() => ({}));
            if (!profileRes.ok) {
                setError(profileData.error || "Failed to save profile.");
                return;
            }
            await refreshAuthProfile();
            navigate("/preferences");
        } catch {
            setError("Could not connect to server. Please try again.");
        }
    };

    return (
        <div className="faded-background d-flex flex-column justify-content-center align-items-center min-vh-100 py-5">

            <div className="p-4 text-center">
                <h1 className="fs-3 text-white">Tell Us About You.</h1>
                <h2 className="fs-6 text-white">Help us get to know you better.</h2>
            </div>

            <div className="login-card p-4 text-start mb-4" style={{ width: "90%", maxWidth: "500px" }}>
                <form onSubmit={handleSubmit}>

                    <h5 className="section-title">Identity &amp; Background</h5>

                    <div className="mb-3">
                        <label>Gender <span className="text-danger">*</span></label>
                        <ToggleGroup options={["Male", "Female", "Non-binary"]} value={profile.gender} onChange={(v) => update("gender", v)} />
                    </div>

                    <div className="mb-3">
                        <label>Religion <span className="text-danger">*</span></label>
                        <select className="form-select" value={profile.religion} onChange={(e) => update("religion", e.target.value)}>
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

                    <div className="mb-3">
                        <label>Ethnicity</label>
                        <select className="form-select" value={profile.ethnicity} onChange={(e) => update("ethnicity", e.target.value)}>
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

                    <div className="mb-3">
                        <label>Education</label>
                        <select className="form-select" value={profile.education} onChange={(e) => update("education", e.target.value)}>
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

                    <div className="mb-3">
                        <label>Your Height: {inchesToDisplay(profile.height)}</label>
                        <input
                            type="range"
                            min="48"
                            max="96"
                            value={profile.height}
                            onChange={(e) => update("height", Number(e.target.value))}
                            className="single-range mt-1"
                        />
                    </div>

                    <div className="mb-4">
                        <label>Family-Oriented?</label>
                        <ToggleGroup options={["Yes", "No"]} value={profile.familyOriented} onChange={(v) => update("familyOriented", v)} />
                    </div>

                    <h5 className="section-title">Lifestyle &amp; Habits</h5>

                    <div className="mb-3">
                        <label>Do you smoke?</label>
                        <ToggleGroup options={["Yes", "No", "Occasionally"]} value={profile.smoker} onChange={(v) => update("smoker", v)} />
                    </div>

                    <div className="mb-3">
                        <label>Do you drink?</label>
                        <ToggleGroup options={["Yes", "No", "Social"]} value={profile.drinker} onChange={(v) => update("drinker", v)} />
                    </div>

                    <div className="mb-3">
                        <label>Do you drink coffee?</label>
                        <ToggleGroup options={["Yes", "No"]} value={profile.coffeeDrinker} onChange={(v) => update("coffeeDrinker", v)} />
                    </div>

                    <div className="mb-3">
                        <label>Diet</label>
                        <ToggleGroup options={["Omnivore", "Vegetarian", "Vegan", "Other"]} value={profile.diet} onChange={(v) => update("diet", v)} />
                    </div>

                    <div className="mb-4">
                        <label>Activity Level</label>
                        <ToggleGroup options={["Low", "Medium", "High"]} value={profile.activityLevel} onChange={(v) => update("activityLevel", v)} />
                    </div>

                    <h5 className="section-title">Interests &amp; Hobbies</h5>

                    <div className="mb-3">
                        <label>Music Preference</label>
                        <select className="form-select" value={profile.musicPref} onChange={(e) => update("musicPref", e.target.value)}>
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

                    <div className="mb-3">
                        <label>Are you a gamer?</label>
                        <ToggleGroup options={["Yes", "No", "Casual"]} value={profile.gamer} onChange={(v) => update("gamer", v)} />
                    </div>

                    <div className="mb-3">
                        <label>Are you a reader?</label>
                        <ToggleGroup options={["Yes", "No", "Occasionally"]} value={profile.reader} onChange={(v) => update("reader", v)} />
                    </div>

                    <div className="mb-3">
                        <label>Do you like to travel?</label>
                        <ToggleGroup options={["Love it", "Occasionally", "Not really"]} value={profile.travel} onChange={(v) => update("travel", v)} />
                    </div>

                    <div className="mb-4">
                        <label>Animals / Pets</label>
                        <select className="form-select" value={profile.pets} onChange={(e) => update("pets", e.target.value)}>
                            <option value="">Select...</option>
                            <option>Love animals</option>
                            <option>Have pets</option>
                            <option>Allergic</option>
                            <option>Not a fan</option>
                            <option>Neutral</option>
                        </select>
                    </div>

                    <h5 className="section-title">Personality &amp; Values</h5>

                    <div className="mb-3">
                        <label>Personality Type <span className="text-danger">*</span></label>
                        <ToggleGroup options={["Introvert", "Extrovert", "Ambivert"]} value={profile.personality} onChange={(v) => update("personality", v)} />
                    </div>

                    <div className="mb-3">
                        <label>Dating Goals <span className="text-danger">*</span></label>
                        <ToggleGroup options={["Casual", "Serious", "Long-term"]} value={profile.datingGoal} onChange={(v) => update("datingGoal", v)} />
                    </div>

                    <div className="mb-3">
                        <label>What's your political standing?</label>
                        <select className="form-select" value={profile.politicalStanding} onChange={(e) => update("politicalStanding", e.target.value)}>
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

                    <div className="mb-3">
                        <label>Bio (optional)</label>
                        <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Tell us more about yourself..."
                            value={profile.bio}
                            onChange={(e) => update("bio", e.target.value)}
                        />
                    </div>

                    <div className="mb-3">
                        <label>Do you have or want children?</label>
                        <ToggleGroup options={["Have kids", "Want kids", "Don't want kids", "Open"]} value={profile.children} onChange={(v) => update("children", v)} />
                    </div>

                    <div className="mb-4">
                        <label>Astrology Sign (optional)</label>
                        <select className="form-select" value={profile.astrology} onChange={(e) => update("astrology", e.target.value)}>
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

                    {error && <p className="text-danger small mb-3">{error}</p>}

                    <div className="text-center">
                        <button type="submit" className="submit-btn">
                            Next: Partner Preferences →
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Questionnaire;