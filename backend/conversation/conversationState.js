// conversationState.js
// Manages per-conversation state in memory.
// Each entry tracks the 4-state model, consent proxy score,
// and behavioral counters defined in the Feature 3 spec.
//
// State model:
//   0 = Introductory   — greetings, small talk
//   1 = Flirting       — light romantic, playful
//   2 = Personal       — feelings, personal disclosures
//   3 = Intimate       — meeting proposals, sensitive topics
//
// In production this would be backed by Redis for persistence across restarts.
// For the capstone demo, in-memory is sufficient.

const STATE = {
    INTRODUCTORY: 0,
    FLIRTING:     1,
    PERSONAL:     2,
    INTIMATE:     3
};

// matchId (integer) → ConversationRecord
const store = new Map();

/** JS Map distinguishes 5 from "5" — always normalize so all callers share one record per match. */
function normalizeMatchId(matchId) {
    const n = parseInt(String(matchId), 10);
    return Number.isNaN(n) ? null : n;
}

function buildDefaultConversation(matchId) {
    return {
        matchId,

        state: STATE.INTRODUCTORY,

        consentScore: 0.50,

        messageCounts: {},
        initiators:    new Set(),

        alternatingCount: 0,
        lastSenderId:     null,

        unansweredCount:    0,
        repeatRequestCount: 0,
        resistanceCount:    0,

        resistanceWindow: [],

        cooldownUntil:    null,
        cooldownSenderId: null,

        totalMessages: 0,

        /** Last user who sent a refusal / boundary message — they may still send neutral follow-ups under restrict escalation. */
        boundarySetByUserId: null,

        // Consent proxy signals (spec §7): timing + balance
        lastMessageAtByUser: {}, // { [userId]: timestamp ms }
        lastRequestStemByUser: {} // { [userId]: normalized stem }
    };
}

// ─── Get or initialize a conversation record ──────────────────────────────
function getConversation(matchId) {
    const id = normalizeMatchId(matchId);
    if (id == null) {
        throw new Error(`Invalid matchId: ${matchId}`);
    }
    if (!store.has(id)) {
        store.set(id, buildDefaultConversation(id));
    }
    return store.get(id);
}

/** Replace in-memory record (used when hydrating from DB). */
function replaceConversation(matchId, conv) {
    const id = normalizeMatchId(matchId);
    if (id == null) {
        throw new Error(`Invalid matchId: ${matchId}`);
    }
    store.set(id, { ...conv, matchId: id });
}

// ─── Persist updates back to the store ────────────────────────────────────
function saveConversation(matchId, updates) {
    const id = normalizeMatchId(matchId);
    if (id == null) {
        throw new Error(`Invalid matchId: ${matchId}`);
    }
    const current = getConversation(id);
    store.set(id, { ...current, ...updates });
}

// ─── Check if a sender is currently under cooldown ────────────────────────
function isOnCooldown(matchId, senderId) {
    const id = normalizeMatchId(matchId);
    if (id == null) return false;
    const conv = getConversation(id);
    if (!conv.cooldownUntil) return false;
    if (parseInt(String(conv.cooldownSenderId), 10) !== parseInt(String(senderId), 10)) return false;
    return new Date() < new Date(conv.cooldownUntil);
}

// ─── Apply a cooldown to a sender (2 minutes for demo; spec says "period") ─
function applyCooldown(matchId, senderId, minutes = 2) {
    const id = normalizeMatchId(matchId);
    if (id == null) return;
    const now = Date.now();
    const addMs = minutes * 60 * 1000;
    const conv = getConversation(id);
    const sid = parseInt(String(senderId), 10);
    const existingSid = conv.cooldownSenderId != null ? parseInt(String(conv.cooldownSenderId), 10) : null;
    if (conv.cooldownUntil && existingSid === sid) {
        const existingEnd = new Date(conv.cooldownUntil).getTime();
        if (existingEnd > now + 500) {
            return;
        }
    }
    const until = new Date(now + addMs);
    saveConversation(id, {
        ...conv,
        cooldownUntil:    until.toISOString(),
        cooldownSenderId: sid
    });
}

// ─── Reset cooldown ────────────────────────────────────────────────────────
function clearCooldown(matchId) {
    const id = normalizeMatchId(matchId);
    if (id == null) return;
    const conv = getConversation(id);
    saveConversation(id, { ...conv, cooldownUntil: null, cooldownSenderId: null });
}

module.exports = {
    STATE,
    buildDefaultConversation,
    normalizeMatchId,
    getConversation,
    replaceConversation,
    saveConversation,
    isOnCooldown,
    applyCooldown,
    clearCooldown
};