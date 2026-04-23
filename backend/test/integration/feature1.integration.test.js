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

describeIntHttp("feature1 integration HTTP", () => {
    test("GET matches without token returns 401", async () => {
        const app = makeFeature1App();
        await withFeature1Server(app, async (baseUrl) => {
            const { status } = await feature1Fetch(baseUrl, "/matches/1", { method: "GET" });
            assert.equal(status, 401);
        });
    });
});

describeIntDb("feature1 integration API", () => {
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
        await pool.query(`DELETE FROM notifications WHERE user_id = ANY($1::int[])`, [a]);
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
                `DELETE FROM swipes WHERE swipe_user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')
                   OR swiped_user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')`
            );
            await pool.query(
                `DELETE FROM matches WHERE user1_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')
                   OR user2_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')`
            );
            await pool.query(
                `DELETE FROM blocks WHERE blocker_user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')
                   OR blocked_user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')`
            );
            await pool.query(`DELETE FROM notifications WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')`);
            await pool.query(`DELETE FROM photo WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')`);
            await pool.query(`DELETE FROM trust_score WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')`);
            await pool.query(
                `DELETE FROM preference_genders WHERE preference_id IN (
                    SELECT preference_id FROM preferences WHERE user_id IN (
                        SELECT user_id FROM users WHERE email LIKE 'f1int_%'))`
            );
            await pool.query(`DELETE FROM preferences WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f1int_%')`);
            await pool.query(`DELETE FROM users WHERE email LIKE 'f1int_%'`);
        } catch {
        }
    });

    dbTest("GET matches returns ranked ids aligned with generateMatches for same viewer", async () => {
        const ts = Date.now();
        const v = await insertUser(`f1int_v_${ts}@test.com`, 1);
        const c1 = await insertUser(`f1int_c1_${ts}@test.com`, 2);
        const c2 = await insertUser(`f1int_c2_${ts}@test.com`, 2);
        try {
            const viewer = await getUserById(v);
            const allCand = await getCandidates(v);
            const { matches: expected } = await generateMatches(viewer, allCand);
            const token = generateToken(v);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${v}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(status, 200);
                const got = json.matches.map((m) => m.user_id);
                const exp = expected.map((m) => m.user_id);
                assert.deepEqual(got, exp);
                const sub = [c1, c2];
                const expSub = exp.filter((id) => sub.includes(id));
                const gotSub = got.filter((id) => sub.includes(id));
                assert.deepEqual(gotSub, expSub);
            });
        } finally {
            await cleanupUserIds([v, c1, c2]);
        }
    });

    dbTest("GET matches excludes swiped users", async () => {
        const ts = Date.now();
        const v = await insertUser(`f1int_sv_${ts}@test.com`, 1);
        const c1 = await insertUser(`f1int_s1_${ts}@test.com`, 2);
        try {
            await pool.query(
                `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
                 VALUES ($1, $2, 'dislike', NOW())`,
                [v, c1]
            );
            const token = generateToken(v);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${v}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(status, 200);
                const ids = json.matches.map((m) => Number(m.user_id));
                assert.ok(!ids.includes(c1));
            });
        } finally {
            await cleanupUserIds([v, c1]);
        }
    });

    dbTest("GET matches excludes blocked users", async () => {
        const ts = Date.now();
        const v = await insertUser(`f1int_bv_${ts}@test.com`, 1);
        const x = await insertUser(`f1int_bx_${ts}@test.com`, 2);
        try {
            await pool.query(
                `INSERT INTO blocks (blocker_user_id, blocked_user_id, blocked_at) VALUES ($1, $2, NOW())`,
                [v, x]
            );
            const token = generateToken(v);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${v}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(status, 200);
                const ids = json.matches.map((m) => Number(m.user_id));
                assert.ok(!ids.includes(x));
            });
        } finally {
            await cleanupUserIds([v, x]);
        }
    });

    dbTest("POST like creates swipe row", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_la_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_lb_${ts}@test.com`, 2);
        try {
            const token = generateToken(a);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { liked_user_id: b },
                });
                assert.equal(status, 201);
                assert.equal(json.match_created, false);
            });
            const cnt = await pool.query(
                `SELECT COUNT(*)::int AS c FROM swipes WHERE swipe_user_id = $1 AND swiped_user_id = $2 AND swipe_type = 'like'`,
                [a, b]
            );
            assert.equal(cnt.rows[0].c, 1);
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("POST mutual like creates match and match_created true", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_ma_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_mb_${ts}@test.com`, 2);
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
                assert.ok(json.match_id != null);
            });
            const mc = await pool.query(
                `SELECT COUNT(*)::int AS c FROM matches
                 WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
                [a, b]
            );
            assert.ok(mc.rows[0].c >= 1);
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("POST mutual like notifies user who liked first", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_na_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_nb_${ts}@test.com`, 2);
        try {
            await pool.query(
                `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
                 VALUES ($1, $2, 'like', NOW())`,
                [b, a]
            );
            const tokenA = generateToken(a);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const like = await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${tokenA}` },
                    body: { liked_user_id: b },
                });
                assert.equal(like.status, 201);
                assert.equal(like.json.match_created, true);

                const notif = await pool.query(
                    `SELECT type, payload
                     FROM notifications
                     WHERE user_id = $1
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [b]
                );
                assert.equal(notif.rows.length, 1);
                assert.equal(notif.rows[0].type, "match_created");
                assert.equal(Number(notif.rows[0].payload.matcher_user_id), a);
            });
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("POST like duplicate returns 409", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_da_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_db_${ts}@test.com`, 2);
        try {
            const token = generateToken(a);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const r1 = await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { liked_user_id: b },
                });
                assert.equal(r1.status, 201);
                const r2 = await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { liked_user_id: b },
                });
                assert.equal(r2.status, 409);
            });
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("GET matches entries include breakdown and match_reasons", async () => {
        const ts = Date.now();
        const v = await insertUser(`f1int_br_${ts}@test.com`, 1);
        const c1 = await insertUser(`f1int_br1_${ts}@test.com`, 2);
        try {
            const token = generateToken(v);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${v}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(status, 200);
                assert.ok(json.matches.length >= 1);
                const m0 = json.matches[0];
                assert.ok(m0.breakdown);
                assert.ok(Array.isArray(m0.match_reasons));
                assert.ok(typeof m0.breakdown.interests === "number");
                assert.ok(typeof m0.image === "string" && m0.image.length > 10);
            });
        } finally {
            await cleanupUserIds([v, c1]);
        }
    });

    dbTest("GET mutual includes matched user and empty last_message for new match", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_ga_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_gb_${ts}@test.com`, 2);
        try {
            await pool.query(
                `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
                 VALUES ($1, $2, 'like', NOW())`,
                [b, a]
            );
            const tokenA = generateToken(a);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${tokenA}` },
                    body: { liked_user_id: b },
                });
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${a}/mutual`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${tokenA}` },
                });
                assert.equal(status, 200);
                const hit = json.matches.find((m) => Number(m.user_id) === b);
                assert.ok(hit);
                assert.equal(hit.last_message, "");
            });
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("GET mutual shows last message when message exists", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_gm_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_gn_${ts}@test.com`, 2);
        try {
            await pool.query(
                `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
                 VALUES ($1, $2, 'like', NOW())`,
                [b, a]
            );
            const tokenA = generateToken(a);
            const app = makeFeature1App();
            let matchId;
            await withFeature1Server(app, async (baseUrl) => {
                await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${tokenA}` },
                    body: { liked_user_id: b },
                });
                const mid = await pool.query(
                    `SELECT match_id FROM matches WHERE user1_id = LEAST($1,$2) AND user2_id = GREATEST($1,$2)`,
                    [a, b]
                );
                matchId = mid.rows[0].match_id;
                await pool.query(
                    `INSERT INTO message (match_id, sender_id, content, sent_at, flagged_for_review)
                     VALUES ($1, $2, 'hello there', NOW(), false)`,
                    [matchId, a]
                );
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${a}/mutual`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${tokenA}` },
                });
                assert.equal(status, 200);
                const hit = json.matches.find((m) => Number(m.user_id) === b);
                assert.ok(hit);
                assert.equal(hit.last_message, "hello there");
            });
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("GET mutual does not list users without match row", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_nm_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_nn_${ts}@test.com`, 2);
        const c = await insertUser(`f1int_no_${ts}@test.com`, 2);
        try {
            await pool.query(
                `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
                 VALUES ($1, $2, 'like', NOW())`,
                [b, a]
            );
            await pool.query(
                `INSERT INTO swipes (swipe_user_id, swiped_user_id, swipe_type, created_at)
                 VALUES ($1, $2, 'like', NOW())`,
                [c, a]
            );
            const tokenA = generateToken(a);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${tokenA}` },
                    body: { liked_user_id: b },
                });
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${a}/mutual`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${tokenA}` },
                });
                assert.equal(status, 200);
                const ids = json.matches.map((m) => Number(m.user_id));
                assert.ok(ids.includes(b));
                assert.ok(!ids.includes(c));
            });
        } finally {
            await cleanupUserIds([a, b, c]);
        }
    });

    dbTest("GET mutual requires reciprocal likes even if match row exists", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_rl_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_rm_${ts}@test.com`, 2);
        try {
            await pool.query(
                `INSERT INTO matches (user1_id, user2_id, match_status, matched_at)
                 VALUES (LEAST($1,$2), GREATEST($1,$2), 'active', NOW())`,
                [a, b]
            );
            const tokenA = generateToken(a);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${a}/mutual`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${tokenA}` },
                });
                assert.equal(status, 200);
                const ids = json.matches.map((m) => Number(m.user_id));
                assert.ok(!ids.includes(b));
            });
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("one-way like returns match_created false", async () => {
        const ts = Date.now();
        const a = await insertUser(`f1int_ow_${ts}@test.com`, 1);
        const b = await insertUser(`f1int_ox_${ts}@test.com`, 2);
        try {
            const token = generateToken(a);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const { status, json } = await feature1Fetch(baseUrl, `/matches/${a}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { liked_user_id: b },
                });
                assert.equal(status, 201);
                assert.equal(json.match_created, false);
            });
        } finally {
            await cleanupUserIds([a, b]);
        }
    });

    dbTest("POST profile photo valid data URL persists after login", async () => {
        const ts = Date.now();
        const em = `f1int_ph_${ts}@test.com`;
        const u = await insertUser(em, 1);
        const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        try {
            const token = generateToken(u);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const up = await feature1Fetch(baseUrl, "/profile/photo", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { photo_url: png },
                });
                assert.equal(up.status, 200);
                const me = await feature1Fetch(baseUrl, "/auth/me", {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(me.status, 200);
                assert.equal(me.json.user.profile_photo_url, png);
                const login = await feature1Fetch(baseUrl, "/auth/login", {
                    method: "POST",
                    body: { email: em, password: "password1" },
                });
                assert.equal(login.status, 200);
                const me2 = await feature1Fetch(baseUrl, "/auth/me", {
                    method: "GET",
                    headers: { Authorization: `Bearer ${login.json.token}` },
                });
                assert.equal(me2.json.user.profile_photo_url, png);
            });
        } finally {
            await cleanupUserIds([u]);
        }
    });

    dbTest("POST profile photo invalid scheme returns 400", async () => {
        const ts = Date.now();
        const u = await insertUser(`f1int_pi_${ts}@test.com`, 1);
        try {
            const token = generateToken(u);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const up = await feature1Fetch(baseUrl, "/profile/photo", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { photo_url: "ftp://example.com/x.png" },
                });
                assert.equal(up.status, 400);
            });
        } finally {
            await cleanupUserIds([u]);
        }
    });

    dbTest("POST profile photo missing photo_url returns 400", async () => {
        const ts = Date.now();
        const u = await insertUser(`f1int_pm_${ts}@test.com`, 1);
        try {
            const token = generateToken(u);
            const app = makeFeature1App();
            await withFeature1Server(app, async (baseUrl) => {
                const up = await feature1Fetch(baseUrl, "/profile/photo", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: {},
                });
                assert.equal(up.status, 400);
            });
        } finally {
            await cleanupUserIds([u]);
        }
    });

    dbTest("signup accepts Chicago IL and creates user", async () => {
        const ts = Date.now();
        const email = `f1int_su_${ts}@test.com`;
        const app = makeFeature1App();
        await withFeature1Server(app, async (baseUrl) => {
            const { status, json } = await feature1Fetch(baseUrl, "/auth/signup", {
                method: "POST",
                body: {
                    firstName: "S",
                    lastName: "U",
                    location: "Chicago, IL",
                    age: 22,
                    email,
                    password: "secret12",
                },
            });
            assert.equal(status, 201);
            assert.ok(json.token);
            assert.ok(json.user.user_id);
        });
        const row = await pool.query(
            `SELECT user_id, latitude, longitude FROM users WHERE email = $1`,
            [email]
        );
        assert.equal(row.rows.length, 1);
        await cleanupUserIds([row.rows[0].user_id]);
    });
});
