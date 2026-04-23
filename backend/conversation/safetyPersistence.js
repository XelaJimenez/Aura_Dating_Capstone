// Loads and saves Feature 3 engine state to PostgreSQL (conversation_safety_state.engine_snapshot).
// Falls back to in-memory-only if the DB is unavailable or the column is missing.

const pool = require("../config/db");
const {
    STATE,
    buildDefaultConversation,
    getConversation,
    replaceConversation,
    normalizeMatchId,
} = require("./conversationState");

const STATE_NAMES = ["introductory", "flirting", "personal", "intimate"];

const loadedFromDb = new Set();

function _mergeDefaults(matchId, raw) {
    const base = buildDefaultConversation(matchId);
    if (!raw || typeof raw !== "object") return base;

    const initiators = new Set(
        Array.isArray(raw.initiators) ? raw.initiators.map(Number) : []
    );

    return {
        ...base,
        ...raw,
        matchId,
        state: typeof raw.state === "number" ? raw.state : base.state,
        consentScore: typeof raw.consentScore === "number" ? raw.consentScore : base.consentScore,
        messageCounts: raw.messageCounts && typeof raw.messageCounts === "object"
            ? raw.messageCounts
            : {},
        initiators,
        alternatingCount: Number(raw.alternatingCount) || 0,
        lastSenderId: raw.lastSenderId != null ? Number(raw.lastSenderId) : null,
        unansweredCount: Number(raw.unansweredCount) || 0,
        repeatRequestCount: Number(raw.repeatRequestCount) || 0,
        resistanceCount: Number(raw.resistanceCount) || 0,
        resistanceWindow: Array.isArray(raw.resistanceWindow) ? raw.resistanceWindow : [],
        cooldownUntil: raw.cooldownUntil || null,
        cooldownSenderId: raw.cooldownSenderId != null ? Number(raw.cooldownSenderId) : null,
        totalMessages: Number(raw.totalMessages) || 0,
        lastMessageAtByUser:
            raw.lastMessageAtByUser && typeof raw.lastMessageAtByUser === "object"
                ? raw.lastMessageAtByUser
                : {},
        lastRequestStemByUser:
            raw.lastRequestStemByUser && typeof raw.lastRequestStemByUser === "object"
                ? raw.lastRequestStemByUser
                : {},
        boundarySetByUserId:
            raw.boundarySetByUserId != null ? Number(raw.boundarySetByUserId) : null,
    };
}

function _serialize(conv) {
    return {
        matchId: conv.matchId,
        state: conv.state,
        consentScore: conv.consentScore,
        messageCounts: { ...conv.messageCounts },
        initiators: Array.from(conv.initiators),
        alternatingCount: conv.alternatingCount,
        lastSenderId: conv.lastSenderId,
        unansweredCount: conv.unansweredCount,
        repeatRequestCount: conv.repeatRequestCount,
        resistanceCount: conv.resistanceCount,
        resistanceWindow: [...conv.resistanceWindow],
        cooldownUntil: conv.cooldownUntil,
        cooldownSenderId: conv.cooldownSenderId,
        totalMessages: conv.totalMessages,
        lastMessageAtByUser: { ...conv.lastMessageAtByUser },
        lastRequestStemByUser: { ...conv.lastRequestStemByUser },
        boundarySetByUserId: conv.boundarySetByUserId != null ? Number(conv.boundarySetByUserId) : null,
    };
}

/**
 * Ensure match conversation is loaded from DB once per process (or defaults).
 */
async function ensureConversationLoaded(matchId) {
    const mid = normalizeMatchId(matchId);
    if (mid == null) return;
    if (loadedFromDb.has(mid)) return;

    if (process.env.FEATURE3_TEST_MODE === "1") {
        getConversation(mid);
        loadedFromDb.add(mid);
        return;
    }

    try {
        const res = await pool.query(
            `SELECT engine_snapshot,
                    current_state,
                    consent_proxy_score,
                    unanswered_count,
                    repeat_request_count,
                    resistance_count
             FROM conversation_safety_state
             WHERE match_id = $1`,
            [mid]
        );

        if (res.rows.length > 0) {
            const row = res.rows[0];
            let merged;
            if (row.engine_snapshot && typeof row.engine_snapshot === "object") {
                merged = _mergeDefaults(mid, row.engine_snapshot);
            } else {
                merged = buildDefaultConversation(mid);
                const cs = row.current_state;
                if (cs === "introductory" || cs === "0") merged.state = STATE.INTRODUCTORY;
                else if (cs === "flirting" || cs === "1") merged.state = STATE.FLIRTING;
                else if (cs === "personal" || cs === "2") merged.state = STATE.PERSONAL;
                else if (cs === "intimate" || cs === "3") merged.state = STATE.INTIMATE;
                if (row.consent_proxy_score != null) {
                    merged.consentScore = Number(row.consent_proxy_score);
                }
                merged.unansweredCount = row.unanswered_count || 0;
                merged.repeatRequestCount = row.repeat_request_count || 0;
                merged.resistanceCount = row.resistance_count || 0;
            }
            replaceConversation(mid, merged);
        } else {
            getConversation(mid);
        }
    } catch (err) {
        if (err.code !== "ENOTFOUND" && err.code !== "ECONNREFUSED") {
            console.error("[safetyPersistence] load failed:", err.message);
        }
        getConversation(mid);
    }

    loadedFromDb.add(mid);
}

async function persistConversation(matchId) {
    const mid = normalizeMatchId(matchId);
    if (mid == null) return;
    if (process.env.FEATURE3_TEST_MODE === "1") {
        return;
    }
    const conv = getConversation(mid);
    const snapshot = _serialize(conv);
    const escalation =
        conv.resistanceCount > 0 || conv.repeatRequestCount >= 3
            ? "restrict"
            : conv.unansweredCount >= 2 || conv.repeatRequestCount >= 1
              ? "warning"
              : "normal";

    const stateName = STATE_NAMES[conv.state] || "introductory";

    try {
        await pool.query(
            `INSERT INTO conversation_safety_state
                (match_id, current_state, consent_proxy_score,
                 unanswered_count, repeat_request_count, resistance_count,
                 escalation_level, last_updated, engine_snapshot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8::jsonb)
             ON CONFLICT (match_id) DO UPDATE SET
                 current_state = EXCLUDED.current_state,
                 consent_proxy_score = EXCLUDED.consent_proxy_score,
                 unanswered_count = EXCLUDED.unanswered_count,
                 repeat_request_count = EXCLUDED.repeat_request_count,
                 resistance_count = EXCLUDED.resistance_count,
                 escalation_level = EXCLUDED.escalation_level,
                 last_updated = NOW(),
                 engine_snapshot = EXCLUDED.engine_snapshot`,
            [
                mid,
                stateName,
                conv.consentScore,
                conv.unansweredCount,
                conv.repeatRequestCount,
                conv.resistanceCount,
                escalation,
                snapshot,
            ]
        );
    } catch (err) {
        if (err.code !== "ENOTFOUND" && err.code !== "ECONNREFUSED") {
            console.error("[safetyPersistence] persist failed:", err.message);
        }
    }
}

function invalidateLoadCacheForTests(matchId) {
    if (matchId == null) loadedFromDb.clear();
    else {
        const mid = normalizeMatchId(matchId);
        if (mid != null) loadedFromDb.delete(mid);
    }
}

module.exports = {
    ensureConversationLoaded,
    persistConversation,
    invalidateLoadCacheForTests,
};
