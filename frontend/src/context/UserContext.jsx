import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { API_BASE_URL } from "../config/api";

const UserContext = createContext();

function formatCityState(city, state) {
    if (city && state) return `${city}, ${state}`;
    return (city || state || "").trim();
}

function normalizeGenderDisplay(name) {
    if (!name) return "";
    if (name === "Man") return "Male";
    if (name === "Woman") return "Female";
    return name;
}

function normalizeFamilyUi(name) {
    if (name == null) return "";
    const s = String(name).trim();
    if (!s) return "";
    if (s === "Yes" || s === "No" || s === "No preference") return s;
    return s;
}

function normalizeChildrenUi(name) {
    if (name == null) return "";
    const s = String(name).trim();
    if (!s) return "";
    const ok = ["Have kids", "Want kids", "Don't want kids", "Open", "No preference"];
    if (ok.includes(s)) return s;
    return s;
}

function mapLegacyNoPreferenceLabel(name) {
    if (name == null) return "";
    const s = String(name).trim();
    if (!s) return "";
    if (s === "No preference") return "Prefer not to say";
    return s;
}

function stripInternalMatchFields(row) {
    if (!row || typeof row !== "object") return row;
    const o = { ...row };
    delete o.trust_penalized;
    return o;
}

function sanitizePhotoUrl(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s === "null" || s === "undefined") return null;
    return s;
}

function scoreId(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function mapAuthUserToProfile(u) {
    let education = u.education_career_name || "";
    if (education === "Trade / Vocational") education = "Trade";
    const first = (u.first_name || "").trim();
    const last = (u.last_name || "").trim();
    const name = [first, last].filter(Boolean).join(" ");
    const hi = u.height_inches;
    const height = typeof hi === "number" && !Number.isNaN(hi) ? hi : hi != null ? Number(hi) || 68 : 68;
    return {
        profilePic: sanitizePhotoUrl(u.profile_photo_url),
        name,
        location: formatCityState(u.location_city, u.location_state),
        dob: u.date_of_birth ? String(u.date_of_birth).slice(0, 10) : "",
        gender: normalizeGenderDisplay(u.gender_name || ""),
        height,
        religion: mapLegacyNoPreferenceLabel(u.religion_name),
        ethnicity: mapLegacyNoPreferenceLabel(u.ethnicity_name),
        education,
        familyOriented: normalizeFamilyUi(u.family_oriented_name),
        smoker: u.smoking_name || "",
        drinker: u.drinking_name || "",
        coffeeDrinker: u.coffee_name || "",
        diet: u.diet_name || "",
        activityLevel: u.activity_name || "",
        musicPref: u.music_name || "",
        gamer: u.isgamer_name || "",
        reader: u.isreader_name || "",
        travel: u.travel_interest_name || "",
        pets: u.pet_interest_name || "",
        personality: u.personality_type_name || "",
        datingGoal: u.dating_goal_name || "",
        bio: u.bio || "",
        astrology: u.astrology_name || "",
        children: normalizeChildrenUi(u.children_name),
        politicalStanding: mapLegacyNoPreferenceLabel(u.political_name),
        trustScore: u.trust_score != null ? Number(u.trust_score) : null,
        trustDisplay: u.trust_display
            ? {
                label: u.trust_display.label,
                shield_count: u.trust_display.shield_count,
                dates_reviewed: u.trust_display.dates_reviewed,
                public_trust_rating: u.trust_display.public_trust_rating,
                show_numeric: u.trust_display.show_numeric,
            }
            : null,
        scoreMusicId: scoreId(u.score_music_id),
        scoreTravelId: scoreId(u.score_travel_id),
        scorePetInterestId: scoreId(u.score_pet_interest_id),
        scoreReaderId: scoreId(u.score_reader_id),
        scoreGamerId: scoreId(u.score_gamer_id),
        scoreActivityLevelId: scoreId(u.score_activity_level_id),
        scoreDrinkingId: scoreId(u.score_drinking_id),
        scoreSmokingId: scoreId(u.score_smoking_id),
        scoreCoffeeId: scoreId(u.score_coffee_id),
        scoreDietId: scoreId(u.score_diet_id),
        scorePersonalityTypeId: scoreId(u.score_personality_type_id),
        scorePoliticalId: scoreId(u.score_political_id),
        scoreDatingGoalsId: scoreId(u.score_dating_goals_id),
        scoreChildrenId: scoreId(u.score_children_id),
        scoreReligionId: scoreId(u.score_religion_id),
        scoreFamilyOrientedId: scoreId(u.score_family_oriented_id),
        scoreEducationCareerId: scoreId(u.score_education_career_id),
    };
}

function defaultPreferences() {
    return {
        genderPref: "",
        genderPrefs: [],
        minAge: 18,
        maxAge: 100,
        religionPref: "",
        ethnicityPref: "",
        minHeight: 60,
        maxHeight: 80,
        politicalPref: "",
        childrenPref: "",
        educationPref: "",
        activityPref: "",
        familyOrientedPref: "",
        datingGoalPref: "",
    };
}

function normalizePartnerTogglePrefs(p) {
    const next = { ...p };
    const toggles = ["childrenPref", "activityPref", "familyOrientedPref", "datingGoalPref"];
    for (const key of toggles) {
        if (next[key] === "" || next[key] == null) {
            next[key] = "No preference";
        }
    }
    if (!Array.isArray(next.genderPrefs)) next.genderPrefs = [];
    else {
        let gp = next.genderPrefs.filter((x) => typeof x === "string");
        if (gp.length === 1 && gp[0] === "Open to all") {
            gp = [];
        } else {
            gp = gp.filter((x) => x !== "Open to all");
        }
        next.genderPrefs = gp;
    }
    if (next.genderPrefs.length === 0) {
        next.genderPref = "No preference";
    } else if (next.genderPrefs.length === 1) {
        next.genderPref = next.genderPrefs[0];
    } else {
        next.genderPref = "Multiple";
    }
    return next;
}

function emptyProfile() {
    return {
        profilePic: null,
        name: "",
        location: "",
        dob: "",
        gender: "",
        height: 68,
        religion: "",
        ethnicity: "",
        education: "",
        familyOriented: "",
        smoker: "",
        drinker: "",
        coffeeDrinker: "",
        diet: "",
        activityLevel: "",
        musicPref: "",
        gamer: "",
        reader: "",
        travel: "",
        pets: "",
        personality: "",
        datingGoal: "",
        bio: "",
        astrology: "",
        children: "",
        politicalStanding: "",
        trustScore: null,
        trustDisplay: null,
    };
}

export function UserProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(() => {
        try { const s = localStorage.getItem("user"); return s ? JSON.parse(s) : null; }
        catch { return null; }
    });
    const [token, setToken] = useState(() => localStorage.getItem("token") || null);
    const [matches, setMatches]           = useState([]);
    const [matchesLoading, setMatchesLoading] = useState(false);
    const [matchesError, setMatchesError] = useState(null);
    const [likesLeft, setLikesLeft]       = useState(null);
    const [tierLimit, setTierLimit]       = useState(3);

    const [likedUsers, setLikedUsers] = useState([]);
    const addLikedUser = (user) => {
        setLikedUsers(prev =>
            prev.find(u => u.user_id === user.user_id) ? prev : [...prev, user]
        );
    };

    const [profile, setProfile] = useState(() => emptyProfile());
    const [preferences, setPreferences] = useState(defaultPreferences);
    const [accountProfileLoaded, setAccountProfileLoaded] = useState(false);
    const [notificationEpoch, setNotificationEpoch] = useState(0);
    const bumpNotificationEpoch = useCallback(() => {
        setNotificationEpoch((n) => n + 1);
    }, []);

    /** Invalidates in-flight GET /matches responses after logout/login or when a newer fetch starts. */
    const matchesFetchGenRef = useRef(0);

    const syncSessionFromAuthUser = useCallback((u) => {
        if (!u) return;
        setProfile(mapAuthUserToProfile(u));
        setCurrentUser((prev) => {
            if (!prev) return prev;
            const updated = {
                ...prev,
                user_id: u.user_id != null ? Number(u.user_id) : prev.user_id,
                first_name: u.first_name ?? prev.first_name,
                last_name: u.last_name ?? prev.last_name,
                email: u.email ?? prev.email,
            };
            try { localStorage.setItem("user", JSON.stringify(updated)); } catch { /* ignore */ }
            return updated;
        });
    }, []);

    const login = (userData, jwtToken) => {
        matchesFetchGenRef.current += 1;
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", jwtToken);
        setCurrentUser(userData);
        setToken(jwtToken);
    };

    const logout = () => {
        matchesFetchGenRef.current += 1;
        try {
            sessionStorage.removeItem("aura_appeal_resolution");
        } catch {
            /* ignore */
        }
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        setCurrentUser(null);
        setToken(null);
        setMatches([]);
        setLikedUsers([]);
        setLikesLeft(null);
        setProfile(emptyProfile());
        setPreferences(normalizePartnerTogglePrefs(defaultPreferences()));
        setAccountProfileLoaded(false);
    };

    const userId = currentUser?.user_id;

    const refreshAuthProfile = useCallback(async () => {
        if (!token) return;
        try {
            const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                if (meData?.user) syncSessionFromAuthUser(meData.user);
            }
        } catch {
            /* ignore */
        }
    }, [token, syncSessionFromAuthUser]);

    const refreshMatches = useCallback(async (opts) => {
        if (!userId || !token) return;
        const myGen = ++matchesFetchGenRef.current;
        const silent = Boolean(opts && opts.silent);
        if (!silent) setMatchesLoading(true);
        setMatchesError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/matches/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (myGen !== matchesFetchGenRef.current) return;
            if (!res.ok) {
                setMatchesError(data.error || "Failed to load matches.");
                if (res.status === 403) setMatches([]);
                return;
            }
            setMatches((data.matches || []).map(stripInternalMatchFields));
            if (data.likes_left !== undefined) setLikesLeft(data.likes_left);
            if (data.tier_limit !== undefined) setTierLimit(data.tier_limit);
        } catch {
            if (myGen !== matchesFetchGenRef.current) return;
            setMatchesError("Could not connect to server.");
        } finally {
            if (myGen !== matchesFetchGenRef.current) return;
            if (!silent) setMatchesLoading(false);
        }
    }, [userId, token]);

    useEffect(() => {
        if (!userId || !token) return;
        refreshMatches();
    }, [userId, token, refreshMatches]);

    useEffect(() => {
        if (!userId || !token) {
            setAccountProfileLoaded(false);
            return;
        }
        let cancelled = false;
        setAccountProfileLoaded(false);
        (async () => {
            try {
                const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!cancelled && meRes.ok) {
                    const meData = await meRes.json();
                    if (meData?.user) syncSessionFromAuthUser(meData.user);
                }
                const prefRes = await fetch(`${API_BASE_URL}/profile/preferences`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!cancelled && prefRes.ok) {
                    const prefData = await prefRes.json();
                    if (prefData?.preferences) {
                        const raw = prefData.preferences;
                        const merged = {
                            ...defaultPreferences(),
                            ...raw,
                            genderPrefs: Array.isArray(raw.genderPrefs) && raw.genderPrefs.length > 0
                                ? raw.genderPrefs
                                : raw.genderPref && raw.genderPref !== "No preference" && raw.genderPref !== "Multiple"
                                    ? [raw.genderPref]
                                    : [],
                        };
                        setPreferences(normalizePartnerTogglePrefs(merged));
                    } else {
                        setPreferences(normalizePartnerTogglePrefs(defaultPreferences()));
                    }
                }
            } catch {
                if (!cancelled) setPreferences(normalizePartnerTogglePrefs(defaultPreferences()));
            } finally {
                if (!cancelled) setAccountProfileLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, [userId, token, syncSessionFromAuthUser]);

    return (
        <UserContext.Provider value={{
            currentUser, token, login, logout,
            matches, matchesLoading, matchesError,
            likesLeft, setLikesLeft, tierLimit,
            likedUsers, addLikedUser,
            profile, setProfile,
            preferences, setPreferences,
            accountProfileLoaded,
            refreshMatches,
            refreshAuthProfile,
            syncSessionFromAuthUser,
            notificationEpoch,
            bumpNotificationEpoch,
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() { return useContext(UserContext); }