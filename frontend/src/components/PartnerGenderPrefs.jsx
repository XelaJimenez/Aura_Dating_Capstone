/**
 * Partner gender: pick Male / Female / Non-binary, or exactly one "Open to all genders"
 * (empty array → no preference_genders rows → matcher treats partner gender as unrestricted).
 *
 * Note: this is different from a user whose own identity is "Open to all" in gender_type —
 * that only affects how others see you (their prefs must include that identity).
 */
export default function PartnerGenderPrefs({ genderPrefs, onChange }) {
    const specific = ["Male", "Female", "Non-binary"];
    const set = new Set(genderPrefs || []);
    const isOpenToAll = set.size === 0;

    const toggleSpecific = (opt) => {
        if (isOpenToAll) {
            onChange([opt]);
            return;
        }
        const next = new Set(set);
        if (next.has(opt)) next.delete(opt);
        else next.add(opt);
        onChange([...next]);
    };

    const selectOpenToAllGenders = () => onChange([]);

    return (
        <div className="d-flex flex-wrap gap-2 mt-1">
            {specific.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => toggleSpecific(opt)}
                    className={`toggle-btn ${!isOpenToAll && set.has(opt) ? "toggle-btn-active" : ""}`}
                >
                    {opt}
                </button>
            ))}
            <button
                type="button"
                onClick={selectOpenToAllGenders}
                className={`toggle-btn ${isOpenToAll ? "toggle-btn-active" : ""}`}
            >
                Open to all genders
            </button>
        </div>
    );
}
