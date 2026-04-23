// safetyEngine.js
// Feature 3: Adaptive Conversation Safety & Consent Engine — Core Decision Engine
//
// Pipeline (spec §8):
//   1. Cooldown check           — sender blocked from a previous violation?
//   2. Message classification   — what category/risk is this message?
//   3. Escalation level         — how many unanswered/resistance signals?
//   4. Hard block check         — severe inappropriate / pressure, or restrict escalation
//   5. State + transition check — is this category allowed in current state?
//   6. Decision output          — deliver | prompt | block
//   7. State/counter update     — update conversation record
//
// All decisions are made BEFORE the message is saved or sent to the recipient.

const {
    STATE,
    getConversation,
    saveConversation,
    isOnCooldown,
    applyCooldown
} = require('./conversationState');

const { ensureConversationLoaded, persistConversation } = require('./safetyPersistence');

const {
    classifyMessage,
    requiredStateForCategory,
    looksLikeRequestOrQuestion
} = require('./riskClassifier');

async function saveAndPersist(matchId, conv) {
    saveConversation(matchId, conv);
    await persistConversation(matchId);
}

function hasActiveCooldown(conv) {
    return !!(conv?.cooldownUntil && new Date() < new Date(conv.cooldownUntil));
}

function isPeerCooldownActive(conv, senderId) {
    if (!hasActiveCooldown(conv)) return false;
    return parseInt(String(conv.cooldownSenderId), 10) !== parseInt(String(senderId), 10);
}

function cooldownWaitText(cooldownUntil) {
    const remainingMs = cooldownUntil
        ? Math.max(0, new Date(cooldownUntil) - new Date())
        : 0;
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return totalSeconds > 60
        ? `Please wait ${minutes} minutes and ${seconds} seconds before sending another message.`
        : `Please wait ${seconds} seconds before sending another message.`;
}

/** When a cooldown has ended, clear escalation counters so the pipeline can recover (spec §6). */
async function expireCooldownIfNeeded(matchId) {
    const conv = getConversation(matchId);
    if (!conv.cooldownUntil) return;
    if (new Date() < new Date(conv.cooldownUntil)) return;
    await saveAndPersist(matchId, {
        ...conv,
        cooldownUntil:       null,
        cooldownSenderId:    null,
        resistanceCount:     0,
        repeatRequestCount:  0,
        resistanceWindow:    [],
        unansweredCount:     0,
        boundarySetByUserId: null
    });
}

// ─── Escalation level computation ─────────────────────────────────────────
// Spec §6 escalation table:
//   Normal  — no counters active
//   Warning — unansweredCount ≥ 2 OR repeatRequestCount ≥ 1
//   Restrict — resistanceCount > 0 OR repeated pressure (repeatRequestCount ≥ 3)
function getEscalationLevel(conv) {
    if (conv.resistanceCount > 0 || conv.repeatRequestCount >= 3) return 'restrict';
    if (conv.unansweredCount >= 2 || conv.repeatRequestCount >= 1) return 'warning';
    return 'normal';
}

// ─── State transition validator ────────────────────────────────────────────
function canTransitionTo(requiredState, conv, senderId) {
    if (requiredState <= conv.state) return true;

    if (requiredState > conv.state + 1) return false;

    const projectedInitiators = new Set(conv.initiators);
    if (senderId != null && !Number.isNaN(parseInt(String(senderId), 10))) {
        projectedInitiators.add(parseInt(String(senderId), 10));
    }

    if (requiredState === STATE.FLIRTING) {
        return projectedInitiators.size >= 2 &&
            conv.resistanceWindow.filter(Boolean).length === 0;
    }

    if (requiredState === STATE.PERSONAL) {
        return conv.alternatingCount >= 3 &&
            conv.resistanceWindow.filter(Boolean).length === 0;
    }

    if (requiredState === STATE.INTIMATE) {
        return conv.consentScore >= 0.6 &&
            conv.resistanceWindow.filter(Boolean).length === 0 &&
            conv.resistanceCount === 0 &&
            conv.alternatingCount >= 4 &&
            (conv.totalMessages || 0) >= 6;
    }

    return false;
}

// ─── Consent proxy score updater ──────────────────────────────────────────
// Spec §7 — soft numerical estimate of mutual engagement (not legal consent).
// Includes: alternation, balanced participation, response timing, resistance, one-sided streaks.
function updateConsentScore(conv, isAlternating, ctx) {
    const { peerLastAt, nowMs } = ctx;
    let delta = 0;

    if (isAlternating) delta += 0.05;
    if (conv.unansweredCount >= 2) delta -= 0.05;
    if (conv.resistanceCount > 0) delta -= 0.10;
    if (conv.consentScore > 0.7 && isAlternating) delta += 0.02;

    // Balanced initiation / participation — both users contributing (spec §7)
    const counts = Object.values(conv.messageCounts || {}).map(Number).filter((n) => n > 0);
    if (counts.length >= 2) {
        const mx = Math.max(...counts);
        const mn = Math.min(...counts);
        const ratio = mx > 0 ? mn / mx : 1;
        if (ratio >= 0.35 && mx >= 3) delta += 0.03;
        if (ratio < 0.22 && mx >= 8) delta -= 0.04;
    }

    // Response timing — quick mutual replies vs very long silence after the peer spoke (spec §7)
    if (isAlternating && peerLastAt != null) {
        const gap = nowMs - peerLastAt;
        if (gap > 48 * 3600000) delta -= 0.05;
        else if (gap < 12 * 60000) delta += 0.025;
    }

    // Topic avoidance proxy — many consecutive messages from one side without reply
    if (conv.unansweredCount >= 3) delta -= 0.04;

    return Math.max(0, Math.min(1, conv.consentScore + delta));
}

/** Person who refused may still send neutral / clarification under restrict escalation (not the other party). */
function _victimBenignFollowUp(conv, senderId, category, riskLevel) {
    if (conv.boundarySetByUserId == null) return false;
    if (parseInt(String(senderId), 10) !== parseInt(String(conv.boundarySetByUserId), 10)) return false;
    if (riskLevel >= 2) return false;
    return category === 'normal' || category === 'refusal';
}

// ─── MAIN EVALUATION FUNCTION ──────────────────────────────────────────────
// Called by socketServer BEFORE saving or sending a message.
//
// Returns:
// {
//   decision:  'deliver' | 'prompt' | 'block',
//   reason:    string | null,         — shown to sender on block/prompt
//   category:  string,                — for logging
//   escalation: string,               — 'normal' | 'warning' | 'restrict'
//   cooldownApplied: boolean
// }
async function evaluateMessage(matchId, senderId, recipientId, content) {
    matchId = parseInt(matchId, 10);
    senderId = parseInt(senderId, 10);
    recipientId = parseInt(recipientId, 10);
    if (Number.isNaN(matchId) || Number.isNaN(senderId) || Number.isNaN(recipientId)) {
        return {
            decision:        'block',
            reason:          'Invalid message context.',
            category:        'invalid',
            escalation:      'normal',
            cooldownApplied: false,
            cooldownUntil:   null
        };
    }

    await ensureConversationLoaded(matchId);
    await expireCooldownIfNeeded(matchId);
    let conv = getConversation(matchId);

    // ── Step 1: Cooldown check ─────────────────────────────────────────────
    if (isOnCooldown(matchId, senderId)) {
        conv = getConversation(matchId);
        return {
            decision:       'block',
            reason:         `You are in a cooldown period. ${cooldownWaitText(conv.cooldownUntil)}`,
            category:       'cooldown',
            escalation:     'restrict',
            cooldownApplied: false,
            cooldownUntil:  conv.cooldownUntil || null
        };
    }

    // ── Step 2: Classify the message ──────────────────────────────────────
    const { category, riskLevel } = classifyMessage(content);
    const requiredState           = requiredStateForCategory(category);

    // ── Step 3: Compute escalation BEFORE updating counters ───────────────
    const peerCooldownActive = isPeerCooldownActive(conv, senderId);
    const escalation = peerCooldownActive ? 'normal' : getEscalationLevel(conv);

    // ── Step 4: Hard blocks — severe inappropriate or pressuring / threatening language
    if (riskLevel === 2) {
        // Apply cooldown — temporary sending restriction after a serious policy violation
        applyCooldown(matchId, senderId, 2);
        conv = getConversation(matchId);
        const cooldownReason = cooldownWaitText(conv.cooldownUntil);
        _updateCounters(conv, senderId, recipientId, category, false, content, {
            suppressEscalationTracking: peerCooldownActive
        });
        await saveAndPersist(matchId, conv);
        return {
            decision:       'block',
            reason:         category === 'explicit'
                ? `This type of message is not allowed on Aura. ${cooldownReason}`
                : `Messages that pressure or threaten someone are not allowed. Your message was not sent. ${cooldownReason}`,
            category,
            escalation,
            cooldownApplied: true,
            cooldownUntil:  conv.cooldownUntil || null
        };
    }

    // Hard block if escalation is restrict — except the user who set the boundary may send neutral follow-ups (E3).
    if (escalation === 'restrict' && !_victimBenignFollowUp(conv, senderId, category, riskLevel)) {
        applyCooldown(matchId, senderId, 2);
        conv = getConversation(matchId);
        const cooldownReason = cooldownWaitText(conv.cooldownUntil);
        _updateCounters(conv, senderId, recipientId, category, false, content, {
            suppressEscalationTracking: peerCooldownActive
        });
        await saveAndPersist(matchId, conv);
        return {
            decision:       'block',
            reason:         `A boundary has been indicated in this conversation. Your message was not sent. ${cooldownReason}`,
            category,
            escalation,
            cooldownApplied: true,
            cooldownUntil:  conv.cooldownUntil || null
        };
    }

    // ── Step 5: State + transition check ──────────────────────────────────
    // Project natural S1→S2 advance using this message’s alternation (counters update later).
    const willAlternate = conv.lastSenderId !== null && conv.lastSenderId !== senderId;
    const projectedAlternating = willAlternate ? conv.alternatingCount + 1 : conv.alternatingCount;
    const projectedInitiators = new Set(conv.initiators);
    projectedInitiators.add(senderId);
    let effectiveState = conv.state;
    if (effectiveState === STATE.INTRODUCTORY &&
        projectedInitiators.size >= 2 &&
        conv.resistanceWindow.filter(Boolean).length === 0) {
        effectiveState = STATE.FLIRTING;
    }
    if (effectiveState === STATE.FLIRTING &&
        projectedAlternating >= 3 &&
        conv.resistanceWindow.filter(Boolean).length === 0) {
        effectiveState = STATE.PERSONAL;
    }
    const convForTransition = effectiveState === conv.state ? conv : { ...conv, state: effectiveState };

    if (requiredState > convForTransition.state) {
        if (!canTransitionTo(requiredState, convForTransition, senderId)) {
            // Invalid transition — block
            _updateCounters(conv, senderId, recipientId, category, false, content, {
                suppressEscalationTracking: peerCooldownActive
            });
            await saveAndPersist(matchId, conv);
            return {
                decision:       'block',
                reason:         _transitionBlockReason(convForTransition.state, requiredState),
                category,
                escalation,
                cooldownApplied: false,
                cooldownUntil:  null
            };
        }
        // Valid transition — advance state to target (may skip natural S1→S2 if message is intimate)
        conv.state = requiredState;
    }

    // ── Step 6: Warning escalation — prompt but allow ─────────────────────
    if (escalation === 'warning' || riskLevel === 1) {
        _updateCounters(conv, senderId, recipientId, category, true, content, {
            suppressEscalationTracking: peerCooldownActive
        });
        await saveAndPersist(matchId, conv);
        return {
            decision:       'prompt',
            reason:         'Just a reminder to make sure the other person is comfortable.',
            category,
            escalation,
            cooldownApplied: false,
            cooldownUntil:  null
        };
    }

    // ── Step 7: All good — deliver ─────────────────────────────────────────
    _updateCounters(conv, senderId, recipientId, category, true, content, {
        suppressEscalationTracking: peerCooldownActive
    });
    await saveAndPersist(matchId, conv);
    return {
        decision:       'deliver',
        reason:         null,
        category,
        escalation,
        cooldownApplied: false,
        cooldownUntil:  null
    };
}

// ─── Internal counter update helper ───────────────────────────────────────
// Updates all behavioral counters and consent score.
// Called AFTER the decision is already made (doesn't affect current decision).
function _updateCounters(conv, senderId, recipientId, category, willDeliver, content, options = {}) {
    const suppressEscalationTracking = options.suppressEscalationTracking === true;
    const nowMs = Date.now();
    const isAlternating = conv.lastSenderId !== null && conv.lastSenderId !== senderId;
    const peerLastAt = conv.lastMessageAtByUser[String(recipientId)];

    // Track initiators (both users must have sent at least one message)
    if (!conv.messageCounts[senderId]) {
        conv.initiators.add(senderId);
    }
    conv.messageCounts[senderId] = (conv.messageCounts[senderId] || 0) + 1;
    conv.totalMessages++;

    // Unanswered count — resets when the other person replies
    if (!suppressEscalationTracking) {
        if (conv.lastSenderId === senderId) {
            conv.unansweredCount++;
        } else {
            conv.unansweredCount = 0;
            if (isAlternating) conv.alternatingCount++;
        }
    }

    // Repeat request / question count (spec §6) — pressure lines or piled-on asks without a reply
    if (!suppressEscalationTracking) {
        const piledOn = conv.lastSenderId !== null && conv.lastSenderId === senderId;
        if (category === 'pressure') {
            conv.repeatRequestCount++;
        } else if (piledOn && looksLikeRequestOrQuestion(content)) {
            conv.repeatRequestCount++;
        }
    }

    // Resistance — any message that signals refusal or discomfort (spec §6).
    if (!suppressEscalationTracking) {
        const refusalSignal = category === 'refusal';
        conv.resistanceWindow = [...conv.resistanceWindow.slice(-4), refusalSignal];
        if (refusalSignal) {
            conv.resistanceCount++;
            conv.boundarySetByUserId = senderId;
        }
    }

    conv.lastMessageAtByUser[String(senderId)] = nowMs;

    conv.consentScore = updateConsentScore(conv, isAlternating, {
        senderId,
        recipientId,
        peerLastAt,
        nowMs
    });

    if (category === 'normal' || category === 'flirty') {
        _tryNaturalStateAdvance(conv);
    }

    conv.lastSenderId = senderId;
}

// ─── Attempt natural state progression ────────────────────────────────────
function _tryNaturalStateAdvance(conv) {
    if (conv.state === STATE.INTRODUCTORY &&
        conv.initiators.size >= 2 &&
        conv.resistanceWindow.filter(Boolean).length === 0) {
        conv.state = STATE.FLIRTING;
        return;
    }
    // S1 → S2: at least 3 alternating exchanges, no resistance in window (spec §4–5).
    if (conv.state === STATE.FLIRTING &&
        conv.alternatingCount >= 3 &&
        conv.resistanceWindow.filter(Boolean).length === 0) {
        conv.state = STATE.PERSONAL;
    }
}

// ─── Human-readable block reasons ─────────────────────────────────────────
function _transitionBlockReason(currentState, requiredState) {
    if (currentState === STATE.INTRODUCTORY && requiredState >= STATE.INTIMATE) {
        return 'This type of message is only appropriate later in a conversation. Take time to get to know each other first.';
    }
    if (requiredState === STATE.INTIMATE) {
        return 'Personal messages like this work best after you\'ve both been chatting for a while. Keep getting to know each other.';
    }
    if (requiredState === STATE.FLIRTING) {
        return 'Wait for the other person to engage before moving in that direction.';
    }
    return 'This message isn\'t appropriate at this stage of the conversation.';
}

module.exports = {
    evaluateMessage,
    feature3Test: {
        getEscalationLevel,
        canTransitionTo,
        updateConsentScore,
        expireCooldownIfNeeded,
    },
};