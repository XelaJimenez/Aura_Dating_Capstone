/**
 * Partner preference toggles (Profile / Preferences UI) ↔ gender_type.gender_name in DB.
 * Never hardcode gender_type_id — IDs differ across databases.
 */

const UI_LABEL_TO_DB_NAME = {
    Male: "Man",
    Female: "Woman",
    "Non-binary": "Non-binary",
    "Open to all": "Open to all",
};

const DB_NAME_TO_UI_LABEL = {
    Man: "Male",
    Woman: "Female",
    "Non-binary": "Non-binary",
    "Open to all": "Open to all",
};

function partnerUiLabelsToDbNames(labels) {
    if (!Array.isArray(labels)) return [];
    const out = [];
    for (const raw of labels) {
        if (!raw || typeof raw !== "string") continue;
        const db = UI_LABEL_TO_DB_NAME[raw] || raw;
        out.push(db);
    }
    return [...new Set(out)];
}

function dbGenderNameToPartnerUi(dbName) {
    if (!dbName) return null;
    return DB_NAME_TO_UI_LABEL[dbName] || null;
}

module.exports = {
    partnerUiLabelsToDbNames,
    dbGenderNameToPartnerUi,
};
