function parseCityStateLocation(raw) {
    if (raw == null || typeof raw !== "string") {
        return { ok: false, error: "Location is required.", city: null, state: null };
    }
    const trimmed = raw.trim();
    if (!trimmed) {
        return { ok: false, error: "Location is required.", city: null, state: null };
    }
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) {
        return {
            ok: false,
            error: "Enter city and state (e.g. Chicago, IL). City or state alone is not enough.",
            city: null,
            state: null,
        };
    }
    const city = parts[0];
    const state = parts.slice(1).join(", ").trim();
    if (!city || !state) {
        return {
            ok: false,
            error: "Enter city and state (e.g. Chicago, IL). Both parts are required.",
            city: null,
            state: null,
        };
    }
    if (/^\d+$/.test(city)) {
        return {
            ok: false,
            error: "Enter a real city name with state (e.g. Chicago, IL).",
            city: null,
            state: null,
        };
    }
    return { ok: true, error: null, city, state };
}

module.exports = { parseCityStateLocation };
