process.env.FEATURE3_TEST_MODE = "1";

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
    classifyMessage,
    looksLikeRequestOrQuestion,
    normalizeRequestStem,
    normalizeForClassification,
} = require("../conversation/riskClassifier");

const { evaluateMessage, feature3Test } = require("../conversation/safetyEngine");
const {
    getEscalationLevel,
    canTransitionTo,
    updateConsentScore,
    expireCooldownIfNeeded,
} = feature3Test;

const {
    STATE,
    buildDefaultConversation,
    getConversation,
    replaceConversation,
    applyCooldown,
    isOnCooldown,
    clearCooldown,
} = require("../conversation/conversationState");

const { invalidateLoadCacheForTests } = require("../conversation/safetyPersistence");

function resetMatch(matchId) {
    invalidateLoadCacheForTests(matchId);
    replaceConversation(matchId, buildDefaultConversation(matchId));
}

function parseWaitSecondsFromReason(reason) {
    if (typeof reason !== "string") return null;
    const mMin = reason.match(/(\d+)\s+minutes?\s+and\s+(\d+)\s+seconds?/i);
    if (mMin) return parseInt(mMin[1], 10) * 60 + parseInt(mMin[2], 10);
    const mSec = reason.match(/(\d+)\s+seconds?/i);
    if (mSec) return parseInt(mSec[1], 10);
    return null;
}

beforeEach(() => {
    invalidateLoadCacheForTests(null);
});

describe("feature3 classifyMessage explicit and grammar variants", () => {
    test("your fat → explicit", () => {
        assert.equal(classifyMessage("your fat").category, "explicit");
    });
    test("you're fat → explicit", () => {
        assert.equal(classifyMessage("you're fat").category, "explicit");
    });
    test("ur fat → explicit", () => {
        assert.equal(classifyMessage("ur fat").category, "explicit");
    });
    test("u r fat → explicit", () => {
        assert.equal(classifyMessage("u r fat").category, "explicit");
    });
    test("youareugly (no spaces) → explicit", () => {
        assert.equal(classifyMessage("youareugly").category, "explicit");
    });
    test("i h8 u → explicit", () => {
        assert.equal(classifyMessage("i h8 u").category, "explicit");
    });
    test("ur so ugly → explicit", () => {
        assert.equal(classifyMessage("ur so ugly").category, "explicit");
    });
    test("u smell → explicit", () => {
        assert.equal(classifyMessage("u smell").category, "explicit");
    });
    test("phat (slur) → explicit", () => {
        assert.equal(classifyMessage("phat").category, "explicit");
    });
    test("coercive pattern → coercive", () => {
        assert.equal(classifyMessage("you owe me").category, "coercive");
    });
    test("refusal → refusal", () => {
        assert.equal(classifyMessage("please stop").category, "refusal");
    });
    test("pressure → pressure", () => {
        assert.equal(classifyMessage("stop ignoring me").category, "pressure");
    });
    test("intimate → intimate", () => {
        assert.equal(classifyMessage("want to hang out").category, "intimate");
    });
    test("flirty → flirty", () => {
        assert.equal(classifyMessage("you are so cute").category, "flirty");
    });
});

describe("feature3 classifyMessage must NOT false-positive", () => {
    test("your fat cat is cute → normal", () => {
        assert.equal(classifyMessage("your fat cat is cute").category, "normal");
    });
    test("you're so great → normal", () => {
        assert.equal(classifyMessage("you're so great").category, "normal");
    });
    test("nice to meet you → normal", () => {
        assert.equal(classifyMessage("nice to meet you").category, "normal");
    });
});

describe("feature3 normalizeForClassification", () => {
    test("abbreviation expansion (ur, u, pls)", () => {
        const n = normalizeForClassification("ur pls msg me");
        assert.match(n, /your/);
        assert.match(n, /please/);
        assert.match(n, /message/);
    });
    test("leet speak digits", () => {
        const n = normalizeForClassification("h3ll0");
        assert.match(n, /hello|hell0/i);
    });
    test("abbreviation and slang expansions", () => {
        const n = normalizeForClassification("idk tbh pls");
        assert.match(n, /i do not know/);
        assert.match(n, /to be honest/);
        assert.match(n, /please/);
    });
    test("already-clean text stays readable", () => {
        const s = "hello world";
        const n = normalizeForClassification(s);
        assert.equal(n.replace(/\s+/g, " ").trim(), "hello world");
    });
    test("already-clean sentence is not corrupted", () => {
        const s = "thanks for chatting today";
        assert.equal(normalizeForClassification(s), s);
    });
});

describe("feature3 looksLikeRequestOrQuestion", () => {
    test("question mark", () => {
        assert.equal(looksLikeRequestOrQuestion("how are you?"), true);
    });
    test("will you pattern", () => {
        assert.equal(looksLikeRequestOrQuestion("will you reply"), true);
    });
    test("too short → false", () => {
        assert.equal(looksLikeRequestOrQuestion("ok"), false);
    });
});

describe("feature3 normalizeRequestStem", () => {
    test("strips punctuation and caps length", () => {
        const s = normalizeRequestStem("  Hello!!!  What do you think?  ");
        assert.match(s, /hello.*what do you think/i);
        assert.ok(s.length <= 96);
    });
});

describe("feature3 getEscalationLevel", () => {
    test("normal", () => {
        assert.equal(
            getEscalationLevel({
                unansweredCount: 0,
                repeatRequestCount: 0,
                resistanceCount: 0,
            }),
            "normal"
        );
    });
    test("warning via unansweredCount", () => {
        assert.equal(
            getEscalationLevel({
                unansweredCount: 2,
                repeatRequestCount: 0,
                resistanceCount: 0,
            }),
            "warning"
        );
    });
    test("warning via repeatRequestCount", () => {
        assert.equal(
            getEscalationLevel({
                unansweredCount: 0,
                repeatRequestCount: 1,
                resistanceCount: 0,
            }),
            "warning"
        );
    });
    test("restrict via resistanceCount", () => {
        assert.equal(
            getEscalationLevel({
                unansweredCount: 0,
                repeatRequestCount: 0,
                resistanceCount: 1,
            }),
            "restrict"
        );
    });
    test("restrict via repeatRequestCount >= 3", () => {
        assert.equal(
            getEscalationLevel({
                unansweredCount: 0,
                repeatRequestCount: 3,
                resistanceCount: 0,
            }),
            "restrict"
        );
    });
});

describe("feature3 canTransitionTo", () => {
    const base = () => ({
        state: STATE.INTRODUCTORY,
        initiators: new Set([10, 20]),
        resistanceWindow: [],
        alternatingCount: 0,
        consentScore: 0.5,
        resistanceCount: 0,
        totalMessages: 0,
    });

    test("same state allows (flirty allowed when already at level)", () => {
        const conv = { ...base(), state: STATE.FLIRTING };
        assert.equal(canTransitionTo(STATE.FLIRTING, conv, 10), true);
    });
    test("S0→S2 skip blocked", () => {
        const conv = { ...base(), state: STATE.INTRODUCTORY, initiators: new Set([10, 20]) };
        assert.equal(canTransitionTo(STATE.PERSONAL, conv, 10), false);
    });
    test("S0→S3 skip blocked", () => {
        const conv = { ...base(), state: STATE.INTRODUCTORY };
        assert.equal(canTransitionTo(STATE.INTIMATE, conv, 10), false);
    });
    test("S0→S1 valid with two initiators including sender projection", () => {
        const conv = {
            ...base(),
            state: STATE.INTRODUCTORY,
            initiators: new Set([10]),
        };
        assert.equal(canTransitionTo(STATE.FLIRTING, conv, 20), true);
    });
    test("S0→S1 invalid with only one initiator and no sender projection peer", () => {
        const conv = {
            ...base(),
            state: STATE.INTRODUCTORY,
            initiators: new Set([10]),
        };
        assert.equal(canTransitionTo(STATE.FLIRTING, conv, 10), false);
    });
    test("S1→S2 requires alternatingCount >= 3", () => {
        const conv = {
            ...base(),
            state: STATE.FLIRTING,
            alternatingCount: 2,
        };
        assert.equal(canTransitionTo(STATE.PERSONAL, conv, 10), false);
        conv.alternatingCount = 3;
        assert.equal(canTransitionTo(STATE.PERSONAL, conv, 10), true);
    });
    test("S2→S3 requires consent and message thresholds", () => {
        const conv = {
            ...base(),
            state: STATE.PERSONAL,
            alternatingCount: 4,
            consentScore: 0.6,
            totalMessages: 6,
            resistanceCount: 0,
            resistanceWindow: [],
        };
        assert.equal(canTransitionTo(STATE.INTIMATE, conv, 10), true);
    });
    test("S2→S3 blocked when consent low", () => {
        const conv = {
            ...base(),
            state: STATE.PERSONAL,
            alternatingCount: 4,
            consentScore: 0.5,
            totalMessages: 10,
            resistanceCount: 0,
            resistanceWindow: [],
        };
        assert.equal(canTransitionTo(STATE.INTIMATE, conv, 10), false);
    });
    test("S1→S3 adjacent only invalid when requirements not met", () => {
        const conv = {
            ...base(),
            state: STATE.FLIRTING,
            alternatingCount: 4,
            consentScore: 0.6,
            totalMessages: 6,
            resistanceCount: 0,
            resistanceWindow: [],
        };
        assert.equal(canTransitionTo(STATE.INTIMATE, conv, 10), false);
    });
});

describe("feature3 updateConsentScore", () => {
    test("increases with alternation and quick reply", () => {
        const conv = {
            consentScore: 0.5,
            unansweredCount: 0,
            resistanceCount: 0,
            messageCounts: { 10: 3, 20: 3 },
        };
        const next = updateConsentScore(conv, true, {
            peerLastAt: Date.now() - 60000,
            nowMs: Date.now(),
        });
        assert.ok(next > conv.consentScore);
    });
    test("decreases with resistance", () => {
        const conv = {
            consentScore: 0.5,
            unansweredCount: 0,
            resistanceCount: 1,
            messageCounts: {},
        };
        const next = updateConsentScore(conv, false, {
            peerLastAt: null,
            nowMs: Date.now(),
        });
        assert.ok(next < conv.consentScore);
    });
});

describe("feature3 applyCooldown idempotency", () => {
    test("second call while active does not reset timer", () => {
        resetMatch(9001);
        applyCooldown(9001, 5, 2);
        const t1 = getConversation(9001).cooldownUntil;
        applyCooldown(9001, 5, 2);
        const t2 = getConversation(9001).cooldownUntil;
        assert.equal(t1, t2);
    });
});

describe("feature3 isOnCooldown lifecycle", () => {
    test("before cooldown → false", () => {
        resetMatch(9002);
        assert.equal(isOnCooldown(9002, 1), false);
    });
    test("during cooldown → true for same sender", () => {
        resetMatch(9003);
        applyCooldown(9003, 7, 2);
        assert.equal(isOnCooldown(9003, 7), true);
    });
    test("after expiry → false", () => {
        resetMatch(9004);
        const past = new Date(Date.now() - 1000).toISOString();
        replaceConversation(9004, {
            ...buildDefaultConversation(9004),
            cooldownUntil: past,
            cooldownSenderId: 8,
        });
        assert.equal(isOnCooldown(9004, 8), false);
    });
});

describe("feature3 expireCooldownIfNeeded", () => {
    test("resets counters when cooldown expired", async () => {
        resetMatch(9005);
        const conv = {
            ...buildDefaultConversation(9005),
            cooldownUntil: new Date(Date.now() - 2000).toISOString(),
            cooldownSenderId: 3,
            resistanceCount: 2,
            repeatRequestCount: 2,
            unansweredCount: 3,
            resistanceWindow: [true],
            boundarySetByUserId: 9,
        };
        replaceConversation(9005, conv);
        await expireCooldownIfNeeded(9005);
        const c = getConversation(9005);
        assert.equal(c.cooldownUntil, null);
        assert.equal(c.resistanceCount, 0);
        assert.equal(c.repeatRequestCount, 0);
        assert.equal(c.unansweredCount, 0);
        assert.deepEqual(c.resistanceWindow, []);
        assert.equal(c.boundarySetByUserId, null);
    });
});

describe("feature3 evaluateMessage integration", () => {
    test("normal message delivers at S0", async () => {
        resetMatch(10001);
        const r = await evaluateMessage(10001, 1, 2, "hello there");
        assert.equal(r.decision, "deliver");
        assert.equal(r.category, "normal");
    });

    test("meet-up blocked at S0 before requirements met", async () => {
        resetMatch(10002);
        const r = await evaluateMessage(10002, 1, 2, "want to meet up tomorrow");
        assert.equal(r.decision, "block");
    });

    test("hang-out blocked at S1 before intimate requirements", async () => {
        resetMatch(10003);
        await evaluateMessage(10003, 1, 2, "hi");
        await evaluateMessage(10003, 2, 1, "hey");
        const r = await evaluateMessage(10003, 1, 2, "wanna hang out");
        assert.equal(r.decision, "block");
    });

    test("flirty blocked when only one user has initiated", async () => {
        resetMatch(10004);
        const r = await evaluateMessage(10004, 1, 2, "you are so cute");
        assert.equal(r.decision, "block");
    });

    test("flirty delivers when both users have initiated", async () => {
        resetMatch(10005);
        await evaluateMessage(10005, 1, 2, "hi");
        const r = await evaluateMessage(10005, 2, 1, "you are so cute");
        assert.equal(r.decision, "deliver");
        assert.equal(r.category, "flirty");
    });

    test("explicit blocked with cooldown on first violation", async () => {
        resetMatch(10006);
        const r = await evaluateMessage(10006, 1, 2, "ur fat");
        assert.equal(r.decision, "block");
        assert.equal(r.category, "explicit");
        assert.equal(r.cooldownApplied, true);
        assert.ok(r.cooldownUntil);
    });

    test("harmful variants blocked", async () => {
        const variants = ["your fat", "u r fat", "youareugly", "i h8 u"];
        for (let i = 0; i < variants.length; i++) {
            resetMatch(10100 + i);
            const r = await evaluateMessage(10100 + i, 1, 2, variants[i]);
            assert.equal(r.decision, "block", variants[i]);
            assert.equal(r.category, "explicit", variants[i]);
        }
    });

    test("safe similar phrase delivers", async () => {
        resetMatch(10007);
        const r = await evaluateMessage(10007, 1, 2, "your fat cat is cute");
        assert.equal(r.decision, "deliver");
    });

    test("cooldown block remaining time lower on second attempt", async () => {
        resetMatch(10008);
        await evaluateMessage(10008, 1, 2, "you are fat");
        const r1 = await evaluateMessage(10008, 1, 2, "hi");
        assert.equal(r1.decision, "block");
        assert.equal(r1.category, "cooldown");
        const s1 = parseWaitSecondsFromReason(r1.reason);
        await new Promise((r) => setTimeout(r, 400));
        const r2 = await evaluateMessage(10008, 1, 2, "hi again");
        assert.equal(r2.decision, "block");
        const s2 = parseWaitSecondsFromReason(r2.reason);
        assert.ok(s1 != null && s2 != null);
        assert.ok(s2 <= s1, `expected countdown ${s2} <= ${s1}`);
    });

    test("applyCooldown idempotency keeps stable timer across block reasons", async () => {
        resetMatch(10009);
        applyCooldown(10009, 1, 2);
        const until = getConversation(10009).cooldownUntil;
        applyCooldown(10009, 1, 2);
        assert.equal(getConversation(10009).cooldownUntil, until);
        const r = await evaluateMessage(10009, 1, 2, "still blocked");
        assert.equal(r.decision, "block");
        assert.equal(r.cooldownUntil, until);
    });

    test("recipient message count unchanged when sender hits cooldown block", async () => {
        resetMatch(10010);
        await evaluateMessage(10010, 1, 2, "hey");
        await evaluateMessage(10010, 1, 2, "you are fat");
        const beforePeer = getConversation(10010).messageCounts[2] || 0;
        await evaluateMessage(10010, 1, 2, "blocked attempt");
        assert.equal(getConversation(10010).messageCounts[2] || 0, beforePeer);
    });

    test("after cooldown expiry normal message delivers and counters reset", async () => {
        resetMatch(10011);
        await evaluateMessage(10011, 1, 2, "you are fat");
        const past = new Date(Date.now() - 5000).toISOString();
        const c = getConversation(10011);
        replaceConversation(10011, { ...c, cooldownUntil: past });
        await expireCooldownIfNeeded(10011);
        const r = await evaluateMessage(10011, 1, 2, "hello");
        assert.equal(r.decision, "deliver");
        const c2 = getConversation(10011);
        assert.equal(c2.resistanceCount, 0);
    });

    test("warning escalation at unanswered threshold", async () => {
        resetMatch(10012);
        await evaluateMessage(10012, 1, 2, "a");
        await evaluateMessage(10012, 1, 2, "b");
        await evaluateMessage(10012, 1, 2, "c");
        const r = await evaluateMessage(10012, 1, 2, "d");
        assert.equal(r.decision, "prompt");
        assert.equal(r.escalation, "warning");
    });

    test("restrict escalation and victim benign follow-up delivers", async () => {
        resetMatch(10013);
        await evaluateMessage(10013, 2, 1, "hello");
        await evaluateMessage(10013, 1, 2, "please stop");
        const rBlock = await evaluateMessage(10013, 2, 1, "why");
        assert.equal(rBlock.decision, "block");
        const rVictim = await evaluateMessage(10013, 1, 2, "ok thanks");
        assert.equal(rVictim.decision, "deliver");
    });

    test("state advances S0→S1→S2→S3 with enough exchanges", async () => {
        resetMatch(10014);
        const uid1 = 11;
        const uid2 = 22;
        await evaluateMessage(10014, uid1, uid2, "m1");
        await evaluateMessage(10014, uid2, uid1, "m2");
        assert.equal(getConversation(10014).state, STATE.FLIRTING);
        await evaluateMessage(10014, uid1, uid2, "m3");
        await evaluateMessage(10014, uid2, uid1, "m4");
        await evaluateMessage(10014, uid1, uid2, "m5");
        await evaluateMessage(10014, uid2, uid1, "m6");
        assert.equal(getConversation(10014).state, STATE.PERSONAL);
        let c = getConversation(10014);
        while (
            c.consentScore < 0.6 ||
            c.alternatingCount < 4 ||
            c.totalMessages < 6
        ) {
            await evaluateMessage(10014, uid1, uid2, "nice");
            await evaluateMessage(10014, uid2, uid1, "cool");
            c = getConversation(10014);
            if (c.totalMessages > 40) break;
        }
        const r = await evaluateMessage(10014, uid1, uid2, "lets grab coffee sometime");
        assert.equal(r.decision, "deliver");
        assert.equal(getConversation(10014).state, STATE.INTIMATE);
    });

    test("invalid S0→S3 intimate blocked", async () => {
        resetMatch(10015);
        const r = await evaluateMessage(10015, 1, 2, "i love you");
        assert.equal(r.decision, "block");
    });

    test("invalid S1→S3 skip blocked", async () => {
        resetMatch(10016);
        await evaluateMessage(10016, 1, 2, "a");
        await evaluateMessage(10016, 2, 1, "b");
        const r = await evaluateMessage(10016, 1, 2, "i need you");
        assert.equal(r.decision, "block");
    });
});

describe("feature3 edge cases", () => {
    test("empty string classify → normal", () => {
        assert.equal(classifyMessage("").category, "normal");
    });
    test("whitespace only classify → normal", () => {
        assert.equal(classifyMessage("   ").category, "normal");
    });
    test("very long benign message delivers", async () => {
        resetMatch(20001);
        const body = `hello ${"x".repeat(4000)}`;
        const r = await evaluateMessage(20001, 1, 2, body);
        assert.equal(r.decision, "deliver");
    });
    test("numbers only", async () => {
        resetMatch(20002);
        const r = await evaluateMessage(20002, 1, 2, "123456789");
        assert.equal(r.decision, "deliver");
    });
    test("punctuation only", async () => {
        resetMatch(20003);
        const r = await evaluateMessage(20003, 1, 2, "...???");
        assert.equal(r.decision, "deliver");
    });
    test("same user repeat without reply increases pressure path", async () => {
        resetMatch(20004);
        await evaluateMessage(20004, 1, 2, "a");
        await evaluateMessage(20004, 1, 2, "will you answer?");
        const r = await evaluateMessage(20004, 1, 2, "will you answer?");
        assert.ok(["prompt", "deliver"].includes(r.decision));
    });
    test("cooldown expires then same violation fresh cooldown", async () => {
        resetMatch(20005);
        await evaluateMessage(20005, 1, 2, "ur fat");
        const firstUntil = getConversation(20005).cooldownUntil;
        assert.ok(firstUntil);
        clearCooldown(20005);
        assert.equal(getConversation(20005).cooldownUntil, null);
        await new Promise((r) => setTimeout(r, 5));
        await evaluateMessage(20005, 1, 2, "ur fat");
        const secondUntil = getConversation(20005).cooldownUntil;
        assert.ok(secondUntil);
        assert.notEqual(firstUntil, secondUntil);
    });
    test("interleaved evaluateMessage leaves consistent totals", async () => {
        resetMatch(20006);
        await Promise.all([
            evaluateMessage(20006, 1, 2, "a"),
            evaluateMessage(20006, 2, 1, "b"),
        ]);
        assert.equal(getConversation(20006).totalMessages, 2);
    });
    test("unsafe wins over safe pattern in one message", async () => {
        resetMatch(20007);
        const r = await evaluateMessage(20007, 1, 2, "no thanks you are fat");
        assert.equal(r.decision, "block");
        assert.equal(r.category, "explicit");
    });
});
