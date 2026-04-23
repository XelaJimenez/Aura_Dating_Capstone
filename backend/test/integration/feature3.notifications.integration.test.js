const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const express = require("express");
const { generateToken } = require("../../utils/jwtHelper");
const { loadFeature1Env, feature1PostgresEnvReady, withFeature1Server, feature1Fetch } = require("../helpers/feature1Http");

const describeIntDb =
    process.env.FEATURE3_INTEGRATION === "1" && feature1PostgresEnvReady() && process.env.JWT_SECRET
        ? describe
        : describe.skip;

describeIntDb("feature3 notifications integration API", () => {
    loadFeature1Env();
    const pool = require("../../config/db");

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

    function makeDatesApp() {
        const app = express();
        app.use(express.json({ limit: "15mb" }));
        app.use("/dates", require("../../routes/dates"));
        return app;
    }

    async function insertUser(email, genderId) {
        const hash = await bcrypt.hash("password1", 4);
        const r = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, date_of_birth,
                account_status, role_id, tier_id, created_at, gender_identity,
                location_city, location_state, latitude, longitude, height_inches)
             VALUES ('F3','N',$1,$2,'1996-06-15','active',1,1,NOW(),$3,
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

    async function cleanupUserIds(ids) {
        if (!ids.length) return;
        const a = ids;
        await pool.query(`DELETE FROM notifications WHERE user_id = ANY($1::int[])`, [a]);
        await pool.query(`DELETE FROM trust_score WHERE user_id = ANY($1::int[])`, [a]);
        await pool.query(`DELETE FROM users WHERE user_id = ANY($1::int[])`, [a]);
    }

    after(async () => {
        try {
            await pool.query(`DELETE FROM notifications WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f3int_%')`);
            await pool.query(`DELETE FROM trust_score WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE 'f3int_%')`);
            await pool.query(`DELETE FROM users WHERE email LIKE 'f3int_%'`);
        } catch {
        }
    });

    dbTest("PATCH read with new_message + match_id updates only that conversation", async () => {
        const ts = Date.now();
        const uid = await insertUser(`f3int_patch_${ts}@test.com`, 1);
        const token = generateToken(uid);

        try {
            await pool.query(
                `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
                 VALUES
                 ($1, 'new_message', $2, false, NOW()),
                 ($1, 'new_message', $3, false, NOW()),
                 ($1, 'date_accepted', $4, false, NOW())`,
                [
                    uid,
                    JSON.stringify({ match_id: 9001, preview: "hi one" }),
                    JSON.stringify({ match_id: 9002, preview: "hi two" }),
                    JSON.stringify({ schedule_id: 55 }),
                ]
            );

            const app = makeDatesApp();
            await withFeature1Server(app, async (baseUrl) => {
                const patch = await feature1Fetch(baseUrl, `/dates/notifications/${uid}/read`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${token}` },
                    body: { types: ["new_message"], match_id: 9001 },
                });
                assert.equal(patch.status, 200);
            });

            const rows = await pool.query(
                `SELECT type, is_read, payload
                 FROM notifications
                 WHERE user_id = $1
                 ORDER BY created_at ASC`,
                [uid]
            );
            const newMsg9001 = rows.rows.find((r) => r.type === "new_message" && Number(r.payload.match_id) === 9001);
            const newMsg9002 = rows.rows.find((r) => r.type === "new_message" && Number(r.payload.match_id) === 9002);
            const accepted = rows.rows.find((r) => r.type === "date_accepted");

            assert.equal(newMsg9001?.is_read, true);
            assert.equal(newMsg9002?.is_read, false);
            assert.equal(accepted?.is_read, false);
        } finally {
            await cleanupUserIds([uid]);
        }
    });

    dbTest("GET notifications returns parsed new_message payload fields", async () => {
        const ts = Date.now();
        const uid = await insertUser(`f3int_get_${ts}@test.com`, 2);
        const token = generateToken(uid);
        const payload = {
            match_id: 8123,
            sender_id: 77,
            sender_name: "Taylor Quinn",
            preview: "Hey, how is your day going?",
        };

        try {
            await pool.query(
                `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
                 VALUES ($1, 'new_message', $2, false, NOW())`,
                [uid, JSON.stringify(payload)]
            );

            const app = makeDatesApp();
            await withFeature1Server(app, async (baseUrl) => {
                const res = await feature1Fetch(baseUrl, `/dates/notifications/${uid}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(res.status, 200);
                assert.ok(Array.isArray(res.json.notifications));
                const msgNotif = res.json.notifications.find((n) => n.type === "new_message");
                assert.ok(msgNotif);
                assert.equal(Number(msgNotif.payload.match_id), payload.match_id);
                assert.equal(String(msgNotif.payload.sender_name), payload.sender_name);
                assert.equal(String(msgNotif.payload.preview), payload.preview);
            });
        } finally {
            await cleanupUserIds([uid]);
        }
    });

    dbTest("PATCH read rejects when token user does not match route user id", async () => {
        const ts = Date.now();
        const uidA = await insertUser(`f3int_forbid_a_${ts}@test.com`, 1);
        const uidB = await insertUser(`f3int_forbid_b_${ts}@test.com`, 2);
        const tokenA = generateToken(uidA);

        try {
            const app = makeDatesApp();
            await withFeature1Server(app, async (baseUrl) => {
                const patch = await feature1Fetch(baseUrl, `/dates/notifications/${uidB}/read`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${tokenA}` },
                    body: { types: ["new_message"], match_id: 9001 },
                });
                assert.equal(patch.status, 403);
            });
        } finally {
            await cleanupUserIds([uidA, uidB]);
        }
    });
});
