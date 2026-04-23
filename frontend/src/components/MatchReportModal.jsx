import { useEffect } from "react";
import ShieldRating from "./ShieldRating";

const DEFAULT_WEIGHTS = { interests: 0.25, lifestyle: 0.25, personality: 0.2, values: 0.3 };

function num(v) {
    if (v == null || v === "") return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
}

function modalShieldRating(user) {
    if (!user) return null;
    const MIN_DATES_FOR_PUBLIC = 3;
    const datesReviewed = num(user.trust_dates_reviewed ?? user.dates_reviewed) ?? 0;
    const fromDisplay = num(user.trust_shield_display);
    if (fromDisplay != null && fromDisplay >= 1 && fromDisplay <= 5) return Math.round(fromDisplay);
    const fromDirect = num(user.shield_rating ?? user.starRating);
    if (fromDirect != null && fromDirect >= 1 && fromDirect <= 5) return Math.round(fromDirect);
    const fromPub = num(user.public_trust_rating);
    if (fromPub != null && datesReviewed >= MIN_DATES_FOR_PUBLIC) {
        return Math.max(1, Math.min(5, Math.round(fromPub)));
    }
    return null;
}

function normLabel(s) {
    return String(s || "").trim().toLowerCase();
}

function displayLabel(s) {
    const t = String(s || "").trim();
    return t || "—";
}

const MARK_OK = "✓";
const MARK_NO = "✗";

function symEqId(youId, themId, youLabel, themLabel) {
    const a = num(youId);
    const b = num(themId);
    if (a != null && b != null) {
        return a === b ? MARK_OK : MARK_NO;
    }
    const na = normLabel(youLabel);
    const nb = normLabel(themLabel);
    if (!na && !nb) return "—";
    if (!na || !nb) return "—";
    return na === nb ? MARK_OK : MARK_NO;
}

function symOrdinalId(youId, themId, youLabel, themLabel) {
    const a = num(youId);
    const b = num(themId);
    if (a != null && b != null) {
        const diff = Math.abs(a - b);
        if (diff === 0) return MARK_OK;
        if (diff === 1) return MARK_OK;
        return MARK_NO;
    }
    const na = normLabel(youLabel);
    const nb = normLabel(themLabel);
    if (!na && !nb) return "—";
    if (!na || !nb) return "—";
    return na === nb ? MARK_OK : MARK_NO;
}

function symPersonalityId(youId, themId, youLabel, themLabel) {
    const a = num(youId);
    const b = num(themId);
    const AMBIVERT_ID = 3;
    if (a != null && b != null) {
        if (a === AMBIVERT_ID || b === AMBIVERT_ID) return MARK_OK;
        if (a === b) return MARK_OK;
        return MARK_NO;
    }
    const na = normLabel(youLabel);
    const nb = normLabel(themLabel);
    if (!na || !nb) return "—";
    if (na.includes("ambivert") || nb.includes("ambivert")) return MARK_OK;
    return na === nb ? MARK_OK : MARK_NO;
}

function inchesToDisplay(inches) {
    const n = num(inches);
    if (n == null) return "—";
    const ft = Math.floor(n / 12);
    const inch = Math.round(n % 12);
    return `${ft}'${inch}"`;
}

function pickYouDatingGoal(preferences, profile) {
    if (preferences?.datingGoalPref && preferences.datingGoalPref !== "No preference") {
        return preferences.datingGoalPref;
    }
    return profile?.datingGoal || "—";
}

function pickYouChildren(preferences, profile) {
    if (preferences?.childrenPref && preferences.childrenPref !== "No preference") {
        return preferences.childrenPref;
    }
    return profile?.children || "—";
}

function pickYouReligion(preferences, profile) {
    if (preferences?.religionPref) return preferences.religionPref;
    return profile?.religion || "—";
}

function pickYouPolitical(preferences, profile) {
    if (preferences?.politicalPref) return preferences.politicalPref;
    return profile?.politicalStanding || "—";
}

function pickYouFamily(preferences, profile) {
    if (preferences?.familyOrientedPref && preferences.familyOrientedPref !== "No preference") {
        return preferences.familyOrientedPref;
    }
    return profile?.familyOriented || "—";
}

function hardConstraintReligionLine(preferences, profile, themReligion) {
    const strict = Boolean(preferences?.religionPref?.trim());
    const youLabel = pickYouReligion(preferences, profile);
    if (strict) {
        return `Religion: Partner requirement (${displayLabel(youLabel)}) · They are ${displayLabel(themReligion)} · ✓ Compatible`;
    }
    return `Religion: No strict partner religion filter · Your profile lists ${displayLabel(youLabel)} · They are ${displayLabel(themReligion)} · ✓ Compatible`;
}

function hardConstraintPoliticalLine(preferences, profile, themPolitical) {
    const strict = Boolean(preferences?.politicalPref?.trim());
    const youLabel = pickYouPolitical(preferences, profile);
    if (strict) {
        return `Political views: Partner requirement (${displayLabel(youLabel)}) · They are ${displayLabel(themPolitical)} · ✓ Compatible`;
    }
    return `Political views: No strict partner political filter · Your profile lists ${displayLabel(youLabel)} · They are ${displayLabel(themPolitical)} · ✓ Compatible`;
}

function hardConstraintEthnicityLine(preferences, match) {
    const strict = Boolean(preferences?.ethnicityPref?.trim());
    const themEth = matchField(match, "ethnicity_name");
    if (strict) {
        return `Ethnicity: Partner requirement (${displayLabel(preferences.ethnicityPref)}) · They are ${displayLabel(themEth)} · ✓ Compatible`;
    }
    return `Ethnicity: No strict partner ethnicity filter · They are ${displayLabel(themEth)} · ✓ Compatible`;
}

function matchField(m, ...keys) {
    for (const k of keys) {
        if (m[k] != null && String(m[k]).trim() !== "") return String(m[k]).trim();
    }
    return "";
}

function allocateWeightedPoints(interestsScore, lifestyleScore, personalityScore, valuesScore, w, rawTarget) {
    const pairs = [
        { dim: interestsScore, wt: w.interests ?? 0.25 },
        { dim: lifestyleScore, wt: w.lifestyle ?? 0.25 },
        { dim: personalityScore, wt: w.personality ?? 0.2 },
        { dim: valuesScore, wt: w.values ?? 0.3 },
    ];
    const exact = pairs.map(({ dim, wt }) => (Number(dim) || 0) * (Number(wt) || 0));
    const floors = exact.map((x) => Math.floor(x + 1e-9));
    const target = Math.round(Number(rawTarget)) || 0;
    let rem = target - floors.reduce((a, b) => a + b, 0);
    const order = exact.map((x, i) => ({ i, frac: x - floors[i] })).sort((a, b) => b.frac - a.frac);
    const out = [...floors];
    let k = 0;
    while (rem > 0 && k < order.length) {
        out[order[k].i]++;
        rem--;
        k++;
    }
    const asc = exact.map((x, i) => ({ i, frac: x - floors[i] })).sort((a, b) => a.frac - b.frac);
    let t = 0;
    while (rem < 0 && t < 48) {
        const idx = asc[t % asc.length].i;
        if (out[idx] > 0) {
            out[idx]--;
            rem++;
        }
        t++;
    }
    return { wi: out[0], wl: out[1], wp: out[2], wv: out[3] };
}

function SubRow({ label, you, them, sym }) {
    return (
        <div className="match-report-modal__subrow">
            <span className="match-report-modal__subrow-label">{label}</span>
            <span className="match-report-modal__subrow-values">
                You: {displayLabel(you)} · Them: {displayLabel(them)} ·{" "}
                <span className="match-report-modal__sym">{sym}</span>
            </span>
        </div>
    );
}

function HardRow({ line }) {
    return (
        <div className="match-report-modal__hard-row">
            {line}
        </div>
    );
}

function DimensionBlock({
    title,
    pct,
    emoji,
    dimScore,
    weightedPts,
    subrows,
    extraNote,
}) {
    return (
        <div className="match-report-modal__dimension">
            <div className="match-report-modal__dimension-title">
                {emoji} {title} — {pct}% of total score
            </div>
            <div className="match-report-modal__subrows">{subrows}</div>
            {extraNote ? <p className="match-report-modal__personality-note">{extraNote}</p> : null}
            <div className="match-report-modal__dimension-score">Dimension score: {dimScore} / 100</div>
            <div className="match-report-modal__dimension-weighted">
                {dimScore} × {pct}% = {weightedPts} points
            </div>
        </div>
    );
}

export default function MatchReportModal({
    open,
    onClose,
    match,
    viewerProfile,
    viewerPreferences,
    matchRank,
    matchTotal,
}) {
    useEffect(() => {
        if (!open) return undefined;
        document.body.classList.add("modal-scroll-lock");
        return () => { document.body.classList.remove("modal-scroll-lock"); };
    }, [open]);

    if (!open || !match) return null;

    const profile = viewerProfile || {};
    const preferences = viewerPreferences || {};
    const bd = match.breakdown || {};
    const w = { ...DEFAULT_WEIGHTS, ...(bd.weights || {}) };
    const interestsScore = bd.interests ?? 0;
    const lifestyleScore = bd.lifestyle ?? 0;
    const personalityScore = bd.personality ?? 0;
    const valuesScore = bd.values ?? 0;
    const rawScore = match.raw_score ?? match.score ?? 0;
    const { wi, wl, wp, wv } = allocateWeightedPoints(
        interestsScore,
        lifestyleScore,
        personalityScore,
        valuesScore,
        w,
        rawScore,
    );
    const finalScore = match.score ?? rawScore;
    const shieldRating = modalShieldRating(match);
    const shieldText = shieldRating != null ? `${shieldRating}` : "not yet shown";

    const mMusic = matchField(match, "music_name");
    const mTravel = matchField(match, "travel_interest_name", "travel_name");
    const mPets = matchField(match, "pet_interest_name", "pets_name");
    const mReader = matchField(match, "isreader_name", "reader_name");
    const mGamer = matchField(match, "isgamer_name", "gamer_name");
    const mActivity = matchField(match, "activity_name");
    const mDrink = matchField(match, "drinking_name");
    const mSmoke = matchField(match, "smoking_name");
    const mDiet = matchField(match, "diet_name");
    const mCoffee = matchField(match, "coffee_name");

    const youMusic = profile.musicPref || "";
    const youTravel = profile.travel || "";
    const youPets = profile.pets || "";
    const youReader = profile.reader || "";
    const youGamer = profile.gamer || "";

    const youActivity = profile.activityLevel || "";
    const youDrink = profile.drinker || "";
    const youSmoke = profile.smoker || "";
    const youDiet = profile.diet || "";
    const youCoffee = profile.coffeeDrinker || "";

    const youPersonality = profile.personality || "";
    const themPersonality = matchField(match, "personality_name");

    const youEducation = profile.education || "";

    const themReligion = matchField(match, "religion_name");
    const themFamily = matchField(match, "family_oriented_name");
    const themPolitical = matchField(match, "political_name");
    const themDating = matchField(match, "dating_goals_name");
    const themChildren = matchField(match, "children_name");
    const themEducation = matchField(match, "education_name");

    const loc = match.location && String(match.location).trim() ? match.location : "their profile area";
    const ageStr = match.age != null && match.age !== "" ? String(match.age) : "—";

    const genderPrefLabel = (() => {
        const gp = preferences?.genderPrefs;
        if (Array.isArray(gp) && gp.length > 0) return gp.join(", ");
        const g = preferences?.genderPref;
        if (g && g !== "No preference" && g !== "Multiple") return g;
        return "all genders";
    })();
    const minA = preferences.minAge ?? 18;
    const maxA = preferences.maxAge ?? 100;
    const minH = preferences.minHeight ?? 60;
    const maxH = preferences.maxHeight ?? 80;

    const datingYou = pickYouDatingGoal(preferences, profile);
    const childrenYou = pickYouChildren(preferences, profile);
    const religionYou = pickYouReligion(preferences, profile);
    const politicalYou = pickYouPolitical(preferences, profile);
    const familyYou = pickYouFamily(preferences, profile);

    const rankNum = matchRank != null ? matchRank : 1;
    const totalNum = matchTotal != null ? matchTotal : 1;

    const onBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="match-report-modal" role="dialog" aria-modal="true" aria-labelledby="match-report-title" onClick={onBackdrop}>
            <div className="match-report-modal__panel" onClick={(e) => e.stopPropagation()}>
                <div className="match-report-modal__header">
                    <h2 id="match-report-title" className="match-report-modal__title">Why this match?</h2>
                    <button type="button" className="match-report-modal__close" onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className="match-report-modal__body">
                    <section className="match-report-modal__section">
                        <h3 className="match-report-modal__section-title">1 — Candidate pool</h3>
                        <p className="match-report-modal__lead">
                            {match.name}, {ageStr}, lives in {loc}. They passed initial eligibility: their gender matches
                            your preference, their age falls within your preferred range, and their account is active.
                        </p>
                    </section>

                    <section className="match-report-modal__section">
                        <h3 className="match-report-modal__section-title">2 — How you were matched</h3>
                        <p className="match-report-modal__muted">
                            Your stack hides inactive accounts, people below the trust safety cutoff, anyone outside your
                            age, height, and distance settings, or who do not fit mutual gender preferences. Dating goals,
                            children, religion, politics, and family orientation influence your compatibility score rather
                            than removing someone from the deck.
                        </p>
                        <div className="match-report-modal__hard-list">
                            <HardRow line={`Mutual gender fit: You are open to ${genderPrefLabel} · They are ${displayLabel(match.gender)} · in stack`} />
                            <HardRow line={`Age (deck filter): Your range is ${minA}–${maxA} · They are ${ageStr} · in range`} />
                            <HardRow line={`Height (deck filter): Your range is ${inchesToDisplay(minH)}–${inchesToDisplay(maxH)} · They are ${displayLabel(match.height)} · in range`} />
                            <HardRow line={`Dating goals (score): You want ${displayLabel(datingYou)} · They want ${displayLabel(themDating)}`} />
                            <HardRow line={`Children (score): You prefer ${displayLabel(childrenYou)} · They are ${displayLabel(themChildren)}`} />
                            <HardRow line={hardConstraintReligionLine(preferences, profile, themReligion)} />
                            <HardRow line={hardConstraintPoliticalLine(preferences, profile, themPolitical)} />
                            <HardRow line={hardConstraintEthnicityLine(preferences, match)} />
                            <HardRow line={`Family orientation (score): You prefer ${displayLabel(familyYou)} · They are ${displayLabel(themFamily)}`} />
                            <HardRow line="Trust: Their account is above the automatic removal threshold · in stack" />
                        </div>
                    </section>

                    <section className="match-report-modal__section">
                        <h3 className="match-report-modal__section-title">3 — Compatibility score breakdown</h3>

                        <DimensionBlock
                            title="Interests"
                            pct={Math.round((w.interests ?? 0.25) * 100)}
                            emoji="🎵"
                            dimScore={interestsScore}
                            weightedPts={wi}
                            subrows={(
                                <>
                                    <SubRow label="Music taste" you={youMusic} them={mMusic} sym={symEqId(profile.scoreMusicId, match.score_music_id, youMusic, mMusic)} />
                                    <SubRow label="Travel interest" you={youTravel} them={mTravel} sym={symOrdinalId(profile.scoreTravelId, match.score_travel_id, youTravel, mTravel)} />
                                    <SubRow label="Pets" you={youPets} them={mPets} sym={symEqId(profile.scorePetInterestId, match.score_pet_interest_id, youPets, mPets)} />
                                    <SubRow label="Reading" you={youReader} them={mReader} sym={symEqId(profile.scoreReaderId, match.score_reader_id, youReader, mReader)} />
                                    <SubRow label="Gaming" you={youGamer} them={mGamer} sym={symEqId(profile.scoreGamerId, match.score_gamer_id, youGamer, mGamer)} />
                                </>
                            )}
                        />

                        <DimensionBlock
                            title="Lifestyle"
                            pct={Math.round((w.lifestyle ?? 0.25) * 100)}
                            emoji="🏃"
                            dimScore={lifestyleScore}
                            weightedPts={wl}
                            subrows={(
                                <>
                                    <SubRow label="Activity level" you={youActivity} them={mActivity} sym={symOrdinalId(profile.scoreActivityLevelId, match.score_activity_level_id, youActivity, mActivity)} />
                                    <SubRow label="Drinking" you={youDrink} them={mDrink} sym={symOrdinalId(profile.scoreDrinkingId, match.score_drinking_id, youDrink, mDrink)} />
                                    <SubRow label="Smoking" you={youSmoke} them={mSmoke} sym={symOrdinalId(profile.scoreSmokingId, match.score_smoking_id, youSmoke, mSmoke)} />
                                    <SubRow label="Diet" you={youDiet} them={mDiet} sym={symEqId(profile.scoreDietId, match.score_diet_id, youDiet, mDiet)} />
                                    <SubRow label="Coffee" you={youCoffee} them={mCoffee} sym={symEqId(profile.scoreCoffeeId, match.score_coffee_id, youCoffee, mCoffee)} />
                                </>
                            )}
                        />

                        <DimensionBlock
                            title="Personality"
                            pct={Math.round((w.personality ?? 0.2) * 100)}
                            emoji="🧠"
                            dimScore={personalityScore}
                            weightedPts={wp}
                            extraNote={'Personality compatibility treats "Ambivert" as flexible: it scores 0.8 with any type. An exact type match scores 1.0, and opposite ends of the scale score 0.4.'}
                            subrows={(
                                <SubRow label="Personality type" you={youPersonality} them={themPersonality} sym={symPersonalityId(profile.scorePersonalityTypeId, match.score_personality_type_id, youPersonality, themPersonality)} />
                            )}
                        />

                        <DimensionBlock
                            title="Values"
                            pct={Math.round((w.values ?? 0.3) * 100)}
                            emoji="💎"
                            dimScore={valuesScore}
                            weightedPts={wv}
                            subrows={(
                                <>
                                    <SubRow label="Religion" you={religionYou} them={themReligion} sym={symEqId(profile.scoreReligionId, match.score_religion_id, religionYou, themReligion)} />
                                    <SubRow label="Family oriented" you={familyYou} them={themFamily} sym={symEqId(profile.scoreFamilyOrientedId, match.score_family_oriented_id, familyYou, themFamily)} />
                                    <SubRow label="Political views" you={politicalYou} them={themPolitical} sym={symOrdinalId(profile.scorePoliticalId, match.score_political_id, politicalYou, themPolitical)} />
                                    <SubRow label="Dating goals" you={datingYou} them={themDating} sym={symEqId(profile.scoreDatingGoalsId, match.score_dating_goals_id, datingYou, themDating)} />
                                    <SubRow label="Children" you={childrenYou} them={themChildren} sym={symEqId(profile.scoreChildrenId, match.score_children_id, childrenYou, themChildren)} />
                                    <SubRow label="Education" you={youEducation} them={themEducation} sym={symEqId(profile.scoreEducationCareerId, match.score_education_career_id, youEducation, themEducation)} />
                                </>
                            )}
                        />

                        <p className="match-report-modal__sum-line">
                            {wi} + {wl} + {wp} + {wv} = {rawScore} raw score
                        </p>
                        <p className="match-report-modal__muted">
                            The four numbers above are whole-point shares of the stored raw score (they always add up
                            to it), while the 0–100 dimension scores come from the matcher before that final rounding.
                        </p>
                    </section>

                    <section className="match-report-modal__section">
                        <h3 className="match-report-modal__section-title">4 — Safety screening</h3>
                        <div className="match-report-modal__shield-block">
                            <ShieldRating rating={shieldRating} />
                        </div>
                        <p className="match-report-modal__lead">
                            Their safety rating is {shieldText}/5 shields. Users rated 1 shield or below are removed
                            entirely. Users rated 2 shields receive a ranking penalty of 15 points.
                        </p>
                    </section>

                    <section className="match-report-modal__section">
                        <h3 className="match-report-modal__section-title">5 — Final score and rank</h3>
                        <p className="match-report-modal__lead">Raw compatibility score: {rawScore}</p>
                        <p className="match-report-modal__lead">Final score: {finalScore} / 100</p>
                        <p className="match-report-modal__lead">
                            Ranked #{rankNum} out of {totalNum} compatible matches shown.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
