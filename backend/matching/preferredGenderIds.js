const { ni } = require("../utils/pgCoerce");

/**
 * Normalize preference_genders from PostgreSQL (array, "{1,2}" string, or rare scalar from drivers).
 */
function normalizePreferredGenderIds(raw) {
    if (raw == null) return [];

    if (typeof raw === "number" || typeof raw === "bigint") {
        const v = ni(raw);
        return v !== null ? [v] : [];
    }

    const pushInts = (arr) =>
        arr
            .map((x) => ni(x))
            .filter((x) => x !== null);

    if (Array.isArray(raw)) return pushInts(raw);

    if (typeof raw === "string") {
        const t = raw.trim();
        if (t.startsWith("{") && t.endsWith("}")) {
            const inner = t.slice(1, -1).trim();
            if (!inner) return [];
            return pushInts(inner.split(","));
        }
    }
    return [];
}

module.exports = { normalizePreferredGenderIds };
