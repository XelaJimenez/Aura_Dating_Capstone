// riskClassifier.js
// Deterministic, rule-based message risk classification.
// No machine learning — fully auditable and explainable.
//
// Returns: { category, riskLevel }
//   category:  internal codes (normal | flirty | intimate | explicit | pressure | coercive | refusal)
//   riskLevel: 0 = safe | 1 = warn sender | 2 = block immediately
//
// Categories map to required conversation states:
//   normal    → STATE 0 (always allowed)
//   flirty    → STATE 1 (requires mutual initiation)
//   intimate  → STATE 3 (requires consent proxy ≥ 0.6, no resistance)
//   explicit  → always blocked (never delivered) — severe inappropriate request (school-safe demo patterns)
//   pressure  → riskLevel 1 (warn)
//   coercive  → always blocked — threats / strong pressure
//   refusal   → riskLevel 0 but triggers resistance tracking

// ─── Pattern definitions (classroom-appropriate wording; no graphic terms) ───

// Blocked immediately (risk 2): severe inappropriate or unsafe requests
const EXPLICIT_PATTERNS = [
    /\bi hate you\b/i,
    /\b(you are ugly|ur ugly|u r ugly)\b/i,
    /\b(you are fat|ur fat|u r fat|phat)\b/i,
    /\b(you smell|u smell)\b/i,
    /\b(nobody likes you|no one likes you)\b/i,
    /\b(you are so dumb|ur so dumb)\b/i,
    /\b(you are worthless|ur worthless)\b/i,
    /\bi wish you were never here\b/i,
    /\beveryone hates you\b/i,
];

const COERCIVE_PATTERNS = [
    /\bif you don'?t .* i will tell everyone\b/i,
    /\bif you don'?t reply i will spread rumors\b/i,
    /\byou have to .* or else\b/i,
    /\b(you owe me)\b/i,
    /\bi demand you\b/i,
    /\byou must .*\b/i,
    /\bstop being so difficult\b/i,
    /\bdo it or i('?m| am) telling (teacher|everyone)\b/i,
];

// WARN — pressure signals (riskLevel 1)
const PRESSURE_PATTERNS = [
    /\bwhy won'?t you answer me\b/i,
    /\bstop ignoring me\b/i,
    /\banswer me\b/i,
    /\bhelloo+\b/i,
    /\byou there\??/i,
    /\bare you (even )?alive\b/i,
    /\bwhy do you keep ignoring\b/i,
    /\bcome on just reply\b/i,
    /\bread this please\b/i,
];

// TRACK resistance — not a block, but increments resistanceCount
const REFUSAL_PATTERNS = [
    /\b(no thanks|not interested)\b/i,
    /\bplease stop\b/i,
    /\bleave me alone\b/i,
    /\b(don'?t (message|text|contact) me)\b/i,
    /\b(stop (texting|messaging|contacting) me)\b/i,
    /\b(i('?m| am) not comfortable)\b/i,
    /\b(i said no)\b/i,
    /\bback off\b/i,
    /\bgo away\b/i,
    /\bstop it\b/i,
    /\bi don'?t want to talk\b/i,
];

// INTIMATE — requires STATE 3
const INTIMATE_PATTERNS = [
    /\b(i (love|miss|need|want) you)\b/i,
    /\b(can'?t stop thinking about you)\b/i,
    /\b((want to|wanna|gonna)\s+hang\s*out|hangout)\b/i,
    /\b(let'?s|lets)\s+(hang\s*out|hangout)\b/i,
    /\b((want to|wanna)\s+meet(\s+up)?|meet\s+up|meeting\s+up)\b/i,
    /\b(let'?s|lets)\s+(meet(\s+up)?|get together)\b/i,
    /\b(wanna\s+meet\s+up|let'?s\s+meet)\b/i,
    /\b(can we|could we|should we)\s+meet\b/i,
    /\b(i\s+)?(want to|wanna|gonna)\s+(meet|see)\s+you\b/i,
    /\b(let'?s|lets)\s+(grab|get)\s+(coffee|lunch|dinner|brunch|a drink)\b/i,
    /\b(grab|get)\s+(coffee|lunch|dinner)\s+(together|sometime)\b/i,
    /\bgo out\s+(with you|sometime|this weekend|tonight)\b/i,
    /\b(come over|come to my place|at my place)\b/i,
    /\blet'?s go on a date\b/i,
    /\b(i('?ve| have) feelings for you)\b/i,
];

// FLIRTY — requires STATE 1
const FLIRTY_PATTERNS = [
    /\b((you('?re| are) so cute|ur so cute))\b/i,
    /\b(you('?re| are) (beautiful|handsome|gorgeous))\b/i,
    /\b(i like you)\b/i,
    /\b(i('?m| am) (really )?into you)\b/i,
    /\b(i have a crush on you)\b/i,
    /\byou('?re| are) sweet\b/i,
];

// ─── Classifier ────────────────────────────────────────────────────────────
function matchesFlexibleExplicit(raw, normalized) {
    const texts = [raw, normalized].filter((x) => typeof x === "string" && x.length > 0);
    for (const s of texts) {
        if (/\b(i hate you|everyone hates you|nobody likes you|no one likes you)\b/i.test(s)) return true;
        if (/\b(i wish you were never here)\b/i.test(s)) return true;
        if (/\b(you'?re|you are|you re|u r|ur)\s+(so\s+)?(fat|ugly|dumb|gross|stupid)\b/i.test(s)) return true;
        if (/\b(your)\s+(so\s+)?fat\b/i.test(s) && !/\byour\s+fat\s+(cat|chance|rolls|wallet|day|loss|bike)\b/i.test(s)) return true;
        if (/\b(fat|ugly)\s+(ass|face|pig|kid|slob)\b/i.test(s)) return true;
        if (/\b(you|u)\s+(smell|stink)\b/i.test(s)) return true;
        if (/\b(you'?re|you are|ur|u r)\s+(worthless|pathetic|useless)\b/i.test(s)) return true;
    }
    return false;
}

function normalizeForClassification(text) {
    if (!text || typeof text !== "string") return "";
    return text
        .toLowerCase()
        .replace(/youareugly/gi, "you are ugly")
        .replace(/\bh8\b/g, "hate")
        .replace(/@/g, "a")
        .replace(/3/g, "e")
        .replace(/1/g, "i")
        .replace(/0/g, "o")
        .replace(/\$/g, "s")
        .replace(/\+/g, "t")
        .replace(/5/g, "s")
        .replace(/!/g, "i")
        .replace(/4/g, "a")
        .replace(/\bur\b/g, "your")
        .replace(/\bu\b/g, "you")
        .replace(/\br\b/g, "are")
        .replace(/\bpls\b/g, "please")
        .replace(/\bplz\b/g, "please")
        .replace(/\bmsg\b/g, "message")
        .replace(/\bmsgs\b/g, "message")
        .replace(/\bbc\b/g, "because")
        .replace(/\bbcuz\b/g, "because")
        .replace(/\bcuz\b/g, "because")
        .replace(/\brn\b/g, "right now")
        .replace(/\bngl\b/g, "not going to lie")
        .replace(/\btbh\b/g, "to be honest")
        .replace(/\bomg\b/g, "oh my")
        .replace(/\bstfu\b/g, "stop talking")
        .replace(/\bgtfo\b/g, "go away")
        .replace(/\bwyd\b/g, "what are you doing")
        .replace(/\bwya\b/g, "where are you")
        .replace(/\bimo\b/g, "in my opinion")
        .replace(/\bimho\b/g, "in my opinion")
        .replace(/\bnvm\b/g, "never mind")
        .replace(/\bidk\b/g, "i do not know")
        .replace(/\bikr\b/g, "i know right")
        .replace(/\bsmh\b/g, "shaking my head")
        .replace(/\bphat\b/g, "fat")
        .replace(/\blmk\b/g, "let me know")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function classifyMessage(text) {
    if (!text || typeof text !== 'string') {
        return { category: 'normal', riskLevel: 0 };
    }

    const raw = text.trim();
    const normalized = normalizeForClassification(raw);
    const matchesEither = (pattern) => pattern.test(raw) || pattern.test(normalized);

    // Check in order of severity — most severe first
    for (const p of COERCIVE_PATTERNS) {
        if (matchesEither(p)) return { category: 'coercive', riskLevel: 2 };
    }
    if (matchesFlexibleExplicit(raw, normalized)) {
        return { category: 'explicit', riskLevel: 2 };
    }
    for (const p of EXPLICIT_PATTERNS) {
        if (matchesEither(p)) return { category: 'explicit', riskLevel: 2 };
    }
    for (const p of REFUSAL_PATTERNS) {
        if (matchesEither(p)) return { category: 'refusal', riskLevel: 0 };
    }
    for (const p of PRESSURE_PATTERNS) {
        if (matchesEither(p)) return { category: 'pressure', riskLevel: 1 };
    }
    for (const p of INTIMATE_PATTERNS) {
        if (matchesEither(p)) return { category: 'intimate', riskLevel: 0 };
    }
    for (const p of FLIRTY_PATTERNS) {
        if (matchesEither(p)) return { category: 'flirty', riskLevel: 0 };
    }

    return { category: 'normal', riskLevel: 0 };
}

// ─── Map category to minimum required conversation state ──────────────────
const STATE = { INTRODUCTORY: 0, FLIRTING: 1, PERSONAL: 2, INTIMATE: 3 };

function requiredStateForCategory(category) {
    switch (category) {
        case 'flirty':   return STATE.FLIRTING;
        case 'intimate': return STATE.INTIMATE;
        case 'explicit': return STATE.INTIMATE + 1; // always too high — blocks regardless
        case 'coercive': return STATE.INTIMATE + 1; // always too high — blocks regardless
        default:         return STATE.INTRODUCTORY;  // normal, pressure, refusal
    }
}

// Heuristic: likely a request or repeated question (spec §6 repeat requests / questions)
const REQUEST_QUESTION_HINTS = [
    /\?/,
    /\b(will you|can you|could you|would you|do you mind)\b/i,
    /\b(when (can|will|are) you|what about|how about)\b/i,
    /\b(please (answer|reply|respond)|did you get)\b/i,
    /\b(what do you think|let me know)\b/i,
];

function looksLikeRequestOrQuestion(text) {
    if (!text || typeof text !== "string") return false;
    const raw = text.trim();
    if (raw.length < 3) return false;
    const normalized = normalizeForClassification(raw);
    return REQUEST_QUESTION_HINTS.some((p) => p.test(raw) || p.test(normalized));
}

/** Short normalized stem to detect the same ask again without a reply from the peer */
function normalizeRequestStem(text) {
    if (!text || typeof text !== "string") return "";
    return normalizeForClassification(text)
        .replace(/\s+/g, " ")
        .replace(/[^\w\s?]/g, "")
        .trim()
        .slice(0, 96);
}

module.exports = {
    classifyMessage,
    requiredStateForCategory,
    looksLikeRequestOrQuestion,
    normalizeRequestStem,
    normalizeForClassification,
};