const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const { test, describe, after, before } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { generateToken } = require("../../utils/jwtHelper");
const {
    loadFeature1Env,
    feature1PostgresEnvReady,
    makeFeature1App,
    withFeature1Server,
    feature1Fetch,
} = require("../helpers/feature1Http");

const describeIntHttp = process.env.FEATURE1_INTEGRATION === "1" ? describe : describe.skip;
const describeIntDb =
    process.env.FEATURE1_INTEGRATION === "1" && feature1PostgresEnvReady() && process.env.JWT_SECRET
        ? describe
        : describe.skip;

describeIntHttp("feature1 comprehensive integration HTTP", () => {
    test("GET matches mutual like reject all without token return 401", async () => {
        const app = makeFeature1App();
        await withFeature1Server(app, async (baseUrl) => {
            const a = await feature1Fetch(baseUrl, "/matches/1", { method: "GET" });
            assert.equal(a.status, 401);
            const b = await feature1Fetch(baseUrl, "/matches/1/mutual", { method: "GET" });
            assert.equal(b.status, 401);
            const c = await feature1Fetch(baseUrl, "/matches/1/like", {
                method: "POST",
                body: { liked_user_id: 2 },
            });
            assert.equal(c.status, 401);
            const d = await feature1Fetch(baseUrl, "/matches/1/reject", {
                method: "POST",
                body: { rejected_user_id: 2 },
            });
            assert.equal(d.status, 401);
            const e = await feature1Fetch(baseUrl, "/matches/all", { method: "GET" });
            assert.equal(e.status, 401);
        });
    });

    test("signup rejects Chicago without state", async () => {
        const ts = Date.now();
        const email = `f1c_loc_${ts}@test.com`;
        const app = makeFeature1App();
        await withFeature1Server(app, async (baseUrl) => {
            const { status, json } = await feature1Fetch(baseUrl, "/auth/signup", {
                method: "POST",
                body: {
                    firstName: "L",
                    lastName: "O",
                    location: "Chicago",
                    age: 22,
                    email,
                    password: "secret12",
                },
            });
            assert.equal(status, 400);
            assert.ok(String(json.error || "").length > 0);
        });
    });
});

describeIntDb("feature1 comprehensive integration API", () => {
    loadFeature1Env();
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

    async function cleanupUserIds(ids) {
        if (!ids.length) return;
        const a = ids;
        await pool.query(
            `DELETE FROM message WHERE match_id IN (
                SELECT match_id FROM matches WHERE user1_id = ANY($1::int[]) OR user2_id = ANY($1::int[])
            )`,
            [a]
        );
        await pool.query(
            `DELETE FROM matches WHERE user1_id = ANY($1::int[]) OR user2_id = ANY($1::int[])`,
            [a]
        );
        await pool.query(
            `DELETE FROM swipes WHERE swipe_user_id = ANY($1::int[]) OR swiped_user_id = ANY($1::int[])`,
            [a]
        );
        await pool.query(
            `DELETE FROM blocks WHERE blocker_user_id = ANY($1::int[]) OR blocked_user_id = ANY($1::int[])`,
            [a]
        );
        await pool.query(`DELETE FROM photo WHERE user_id = ANY($1::int[])`, [a]);
        await pool.query(`DELETE FROM trust_score WHERE user_id = ANY($1::int[])`, [a]);
        await pool.query(
            `DELETE FROM preference_genders WHERE preference_id IN (
                SELECT preference_id FROM preferences WHERE user_id = ANY($1::int[])
            )`,
            [a]
        );
        await pool.query(`DELETE FROM preferences WHERE user_id = ANY($1::int[])`, [a]);
        await pool.query(`DELETE FROM users WHERE user_id = ANY($1::int[])`, [a]);
    }

    async function insertUser(email, genderId) {
        const hash = await bcrypt.hash("password1", 4);
        const r = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, date_of_birth,
                account_status, role_id, tier_id, created_at, gender_identity,
                location_city, location_state, latitude, longitude, height_inches)
             VALUES ('F1','T',$1,$2,'1996-06-15','active',1,1,NOW(),$3,
                'Chicago','IL',41.878113,-87.629799,68)
             RETURNING user_id`,
            [email, hash, genderId]
        );
        const uid = r.rows[0].user_id;
        await pool.query(
            `INSERT INTO trust_score (user_id, internal_score, last_updated) VALUES ($1, 75, NOW())`,
            [uid]
        );
        return uid;
    }

    after(async () => {
        try {
            await pool.query(
                `DELETE FROM swipes WHERE swipe_user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')
                   OR swiped_user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')`
            );
            await pool.query(
                `DELETE FROM matches WHERE user1_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')
                   OR user2_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')`
            );
            await pool.query(
                `DELETE FROM blocks WHERE blocker_user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')
                   OR blocked_user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')`
            );
            await pool.query(`DELETE FROM photo WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')`);
            await pool.query(`DELETE FROM trust_score WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')`);
            await pool.query(
                `DELETE FROM preference_genders WHERE preference_id IN (
                    SELECT preference_id FROM preferences WHERE user_id IN (
                        SELECT user_id FROM users WHERE email LIKE 'f1c_%'))`
            );
            await pool.query(`DELETE FROM preferences WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1c_%')`);
            await pool.query(`DELETE FROM users WHERE email LIKE 'f1c_%'`);
        } catch {
        }
    });

    dbTest("GET matches ranked ids stable after swipe reset", async () => {
        const ts = Date.now();
        const v = await insertUser(`f1c_v_${ts}@test.com`, 1);
        const c1 = await insertUser(`f1c_a_${ts}@test.com`, 2);
        const c2 = await insertUser(`f1c_b_${ts}@test.com`, 2);
        try {
            const viewer = await getUserById(v);
            const allCand = await getCandidates(v);
            const { matches: m1 } = await generateMatches(viewer, allCand);
            await pool.query(`DELETE FROM swipes WHERE swipe_user_id = $1 OR swiped_user_id = $1`, [v]);
            await pool.query(
                `DELETE FROM matches WHERE user1_id = $1 OR user2_id = $1 OR user1_id = ANY($2::int[]) OR user2_id = ANY($2::int[])`,
                [v, [c1, c2]]
            );
            const viewer2 = await getUserById(v);
            const allCand2 = await getCandidates(v);
            const { matches: m2 } = await generateMatches(viewer2, allCand2);
            assert.deepEqual(
                m1.map((x) => Number(x.user_id)),
                m2.map((x) => Number(x.user_id))
            );
        } finally {
            await cleanupUserIds([v, c1, c2]);
        }
    });

    dbTest("GET matches includes per-candidate breakdown by user id", async () => {
        const ts = Date.now();
        const v = await insertUser(`f1c_br_${ts}@test.com`, 1);
        const c1 = await insertUser(`f1c_br1_${ts}@test.com`, 2);
        try {
            const token = generateToken(v);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${v}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(status, 200);
                const hit = json.matches.find((m) => Number(m.user_id) === c1);
                assert.ok(hit);
                assert.ok(hit.breakdown);
                assert.ok(Array.isArray(hit.match_reasons));
                assert.ok(typeof hit.breakdown.values === "number");
            });
        } finally {
            await cleanupUserIds([v, c1]);
        }
    });

    dbTest("mutual like response exposes match_created for overlay parity", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1c_ov_${ts}@test.com`, 1);
        const b = await insertUser(`f1c_ow_${ts}@test.com`, 2);
        try {
            await pool.query(
                `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
                 VALUES ($1, $2, 'like', NOW())`,
                [b, a]
            );
            const token = generateToken(a);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { liked_user_id: b },
                });
                assert.equal(status, 201);
                assert.equal(json.match_created, true);
                assert.equal(Boolean(json.match_created), true);
            });
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("POST profile photo https url persists in users and photo table", async () => {
        const ts = Date.now();
        const u = await insertUser(`f1c_hp_${ts}@test.com`, 1);
        const url = "https://example.com/photo.jpg";
        try {
            const token = generateToken(u);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const up = await feature1Fetch(baseUrl, "/profile/photo", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { photo_url: url },
                });
                assert.equal(up.status, 200);
                assert.equal(up.json.photo_url, url);
            });
            const row = await pool.query(
                `SELECT profile_photo_url FROM users WHERE user_id = $1`,
                [u]
            );
            assert.equal(row.rows[0].profile_photo_url, url);
            const ph = await pool.query(
                `SELECT photo_url FROM photo WHERE user_id = $1 AND is_primary = true`,
                [u]
            );
            assert.equal(ph.rows[0].photo_url, url);
        } finally {
            await cleanupUserIds([u]);
        }
    });

    dbTest("signup geocode empty array still creates user with null coords", async () => {
        const ts = Date.now();
        const email = `f1c_geo_${ts}@test.com`;
        const orig = global.fetch;
        global.fetch = async (url, init) => {
            if (String(url).includes("nominatim.openstreetmap.org")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => [],
                    text: async () => "[]",
                };
            }
            return orig(url, init);
        };
        const app = makeFeature1App();
        try {
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, "/auth/signup", {
                    method: "POST",
                    body: {
                        firstName: "G",
                        lastName: "E",
                        location: "Peoria, IL",
                        age: 22,
                        email,
                        password: "secret12",
                    },
                });
                assert.equal(status, 201);
                assert.ok(json.token);
            });
        } finally {
            global.fetch = orig;
        }
        const row = await pool.query(
            `SELECT user_id, latitude, longitude FROM users WHERE email = $1`,
            [email]
        );
        assert.equal(row.rows.length, 1);
        assert.equal(row.rows[0].latitude, null);
        assert.equal(row.rows[0].longitude, null);
        await cleanupUserIds([row.rows[0].user_id]);
    });
});

const describeReg =
    process.env.FEATURE1_REGRESSION === "1" && feature1PostgresEnvReady() && process.env.JWT_SECRET
        ? describe
        : describe.skip;

describeReg("feature1 comprehensive regression audit parity", () => {
    loadFeature1Env();
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

    function dbTestReg(name, fn) {
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

    async function candidatesForMatchesApi(userId) {
        const allCandidates = await getCandidates(userId);
        const swipedResult = await pool.query(
            `SELECT swiped_user_id FROM swipes
             WHERE swipe_user_id = $1
               AND swipe_type IN ('like', 'dislike', 'superlike')`,
            [userId]
        );
        const swipedIds = new Set(
            swipedResult.rows.map((r) => Number(r.swiped_user_id)).filter((id) => !Number.isNaN(id))
        );
        return allCandidates.filter((c) => !swipedIds.has(Number(c.user_id)));
    }

    dbTestReg("Avery 122 ranked order stable across generateMatches calls", async () => {
        assert.ok(await userExists(122));
        const viewer = await getUserById(122);
        const cand = await candidatesForMatchesApi(122);
        const { matches: a } = await generateMatches(viewer, cand);
        const { matches: b } = await generateMatches(viewer, cand);
        assert.deepEqual(
            a.map((x) => ({ id: Number(x.user_id), score: x.score })),
            b.map((x) => ({ id: Number(x.user_id), score: x.score }))
        );
    });

    dbTestReg("GET matches for Avery 122 aligns with service ranking for same candidate pool", async () => {
        assert.ok(await userExists(122));
        const viewer = await getUserById(122);
        const poolCand = await candidatesForMatchesApi(122);
        const { matches: expected } = await generateMatches(viewer, poolCand);
        const token = generateToken(122);
        const app = makeFeature1App();
        await withFeature1Server(app, async (baseUrl) => {
            const { status, json } = await feature1Fetch(baseUrl, "/matches/122", {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(status, 200);
            const got = json.matches.map((m) => Number(m.user_id));
            const exp = expected.map((m) => Number(m.user_id));
            assert.deepEqual(got, exp);
        });
    });
});
