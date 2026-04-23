const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const { loadFeature1Env, feature1PostgresEnvReady } = require("../helpers/feature1Http");

loadFeature1Env();

const run = process.env.FEATURE1_REGRESSION === "1" && feature1PostgresEnvReady();
const describeReg = run ? describe : describe.skip;

describeReg("feature1 regression curated users", () => {
    const pool = require("../../config/db");
    const { getUserById, getCandidates } = require("../../services/userService");
    const generateMatches = require("../../services/matchingService");

    let postgresReachable = false;
    before(async () => {
        try {
            await pool.query("SELECT 1");
            postgresReachable = true;
        } catch {
            postgresReachable = false;
        }
    });

    function dbTest(name, fn) {
        test(name, async (t) => {
            if (!postgresReachable) {
                t.skip("Postgres unreachable");
                return;
            }
            await fn();
        });
    }

    async function userExists(userId) {
        const r = await pool.query("SELECT user_id FROM users WHERE user_id = $1", [userId]);
        return r.rows.length > 0;
    }

    dbTest("Avery 122 to Dante 111 raw score 69", async () => {
        assert.ok(await userExists(122));
        assert.ok(await userExists(111));
        const viewer = await getUserById(122);
        const cand = await getCandidates(122);
        const { matches } = await generateMatches(viewer, cand);
        const m = matches.find((x) => Number(x.user_id) === 111);
        assert.ok(m);
        assert.equal(m.raw_score, 69);
    });

    dbTest("Dante 111 to Beatrice 112 raw score 69", async () => {
        assert.ok(await userExists(111));
        assert.ok(await userExists(112));
        const viewer = await getUserById(111);
        const cand = await getCandidates(111);
        const { matches } = await generateMatches(viewer, cand);
        const m = matches.find((x) => Number(x.user_id) === 112);
        assert.ok(m);
        assert.equal(m.raw_score, 69);
    });

    dbTest("Finley 121 trust penalty raw 84 to displayed 69", async () => {
        assert.ok(await userExists(121));
        let found = false;
        const viewers = await pool.query(
            `SELECT user_id FROM users WHERE account_status = 'active' AND user_id != 121 LIMIT 80`
        );
        for (const row of viewers.rows) {
            const vid = row.user_id;
            const viewer = await getUserById(vid);
            if (!viewer) continue;
            const cand = await getCandidates(vid);
            const { matches } = await generateMatches(viewer, cand);
            const m = matches.find((x) => Number(x.user_id) === 121);
            if (m && m.raw_score === 84) {
                assert.equal(m.score, 69);
                assert.equal(m.trust_penalized, true);
                found = true;
                break;
            }
        }
        assert.ok(found);
    });

    dbTest("Reese 124 trust 35 appears in no ranked deck", async () => {
        assert.ok(await userExists(124));
        const viewers = await pool.query(
            `SELECT user_id FROM users WHERE account_status = 'active' AND user_id != 124 LIMIT 60`
        );
        for (const row of viewers.rows) {
            const viewer = await getUserById(row.user_id);
            const cand = await getCandidates(row.user_id);
            const { matches } = await generateMatches(viewer, cand);
            assert.ok(!matches.some((m) => Number(m.user_id) === 124));
        }
    });

    dbTest("Reese 124 as viewer gets no deck (own trust at or below cutoff)", async () => {
        assert.ok(await userExists(124));
        const viewer = await getUserById(124);
        const cand = await getCandidates(124);
        const { matches } = await generateMatches(viewer, cand);
        assert.equal(matches.length, 0);
    });

    dbTest("Shane 115 trust 25 excluded from every pool", async () => {
        assert.ok(await userExists(115));
        const viewers = await pool.query(
            `SELECT user_id FROM users WHERE account_status = 'active' AND user_id != 115 LIMIT 60`
        );
        for (const row of viewers.rows) {
            const viewer = await getUserById(row.user_id);
            const cand = await getCandidates(row.user_id);
            const { matches } = await generateMatches(viewer, cand);
            assert.ok(!matches.some((m) => Number(m.user_id) === 115));
        }
    });

    dbTest("Jasmine 119 gets zero matches", async () => {
        assert.ok(await userExists(119));
        const viewer = await getUserById(119);
        const cand = await getCandidates(119);
        const { matches } = await generateMatches(viewer, cand);
        assert.equal(matches.length, 0);
    });

    dbTest("Sandra 118 gets zero matches", async () => {
        assert.ok(await userExists(118));
        const viewer = await getUserById(118);
        const cand = await getCandidates(118);
        const { matches } = await generateMatches(viewer, cand);
        assert.equal(matches.length, 0);
    });

    dbTest("Derek 120 suspended never in candidate rows", async () => {
        assert.ok(await userExists(120));
        const st = await pool.query(`SELECT account_status FROM users WHERE user_id = 120`);
        assert.notEqual(st.rows[0].account_status, "active");
        const viewers = await pool.query(
            `SELECT user_id FROM users WHERE account_status = 'active' AND user_id != 120 LIMIT 40`
        );
        for (const row of viewers.rows) {
            const cand = await getCandidates(row.user_id);
            assert.ok(!cand.some((c) => Number(c.user_id) === 120));
        }
    });
});
