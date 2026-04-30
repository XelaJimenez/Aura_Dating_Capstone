/**
 * Feature 2 Demo Reset Script
 * Run: node scripts/resetFeature2Demo.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      { rejectUnauthorized: false }
});

async function run() {
    const finleyResult = await pool.query(
        `SELECT user_id FROM users WHERE email = 'finley@test.com' LIMIT 1`
    );
    const morganResult = await pool.query(
        `SELECT user_id FROM users WHERE email = 'morgan@test.com' LIMIT 1`
    );

    if (finleyResult.rows.length === 0) {
        console.error('❌ Finley not found — run db:seed:demo first');
        process.exit(1);
    }
    if (morganResult.rows.length === 0) {
        console.error('❌ Morgan not found — run db:seed:demo first');
        process.exit(1);
    }

    const finleyId = finleyResult.rows[0].user_id;
    const morganId = morganResult.rows[0].user_id;

    console.log(`✅ Found Finley: user_id=${finleyId}`);
    console.log(`✅ Found Morgan: user_id=${morganId}`);

    console.log('\nClearing existing Feature 2 data...');

    const scheduleRows = await pool.query(
        `SELECT DISTINCT ds.schedule_id
         FROM date_scheduling ds
         JOIN matches m ON m.match_id = ds.match_id
         WHERE (m.user1_id = $1 OR m.user2_id = $1
             OR m.user1_id = $2 OR m.user2_id = $2)`,
        [finleyId, morganId]
    );
    const scheduleIds = scheduleRows.rows.map(r => r.schedule_id);

    if (scheduleIds.length > 0) {
        await pool.query(
            `DELETE FROM post_date_checkin WHERE schedule_id = ANY($1::int[])`,
            [scheduleIds]
        );
        await pool.query(
            `DELETE FROM survey_trigger WHERE schedule_id = ANY($1::int[])`,
            [scheduleIds]
        );
    }

    await pool.query(
        `DELETE FROM post_date_checkin
         WHERE reviewer_user_id IN ($1, $2)
            OR reviewed_user_id IN ($1, $2)`,
        [finleyId, morganId]
    );
    await pool.query(
        `DELETE FROM trust_safety_events WHERE subject_user_id IN ($1, $2)`,
        [finleyId, morganId]
    );

    await pool.query(
        `DELETE FROM moderation_appeals WHERE user_id IN ($1, $2)`,
        [finleyId, morganId]
    );

    await pool.query(
        `DELETE FROM moderation_actions WHERE user_id IN ($1, $2)`,
        [finleyId, morganId]
    );

    await pool.query(
        `DELETE FROM trust_score_history WHERE user_id IN ($1, $2)`,
        [finleyId, morganId]
    );
    await pool.query(
        `DELETE FROM date_scheduling ds
         USING matches m
         WHERE ds.match_id = m.match_id
           AND (m.user1_id IN ($1, $2) OR m.user2_id IN ($1, $2))`,
        [finleyId, morganId]
    );
    await pool.query(
        `DELETE FROM notifications WHERE user_id IN ($1, $2)`,
        [finleyId, morganId]
    );


    await pool.query(
        `DELETE FROM swipes WHERE swipe_user_id = $1`,
        [morganId]
    );

    await pool.query(
        `DELETE FROM swipes
         WHERE (swipe_user_id = $1 OR swiped_user_id = $1)`,
        [finleyId]
    );

    await pool.query(
        `DELETE FROM matches
         WHERE (user1_id = $1 OR user2_id = $1)
            OR (user1_id = $2 OR user2_id = $2)`,
        [finleyId, morganId]
    );
    console.log('  ✓ All cleared');

    // Reset trust scores
    await pool.query(
        `UPDATE trust_score
         SET internal_score = 75,
             public_trust_rating = NULL,
             trust_frozen_until = NULL,
             freeze_reason = NULL,
             last_updated = NOW()
         WHERE user_id IN ($1, $2)`,
        [finleyId, morganId]
    );
    // Insert if missing
    await pool.query(
        `INSERT INTO trust_score (user_id, internal_score, last_updated)
         SELECT u, 75, NOW() FROM (VALUES ($1::int), ($2::int)) AS t(u)
         WHERE NOT EXISTS (SELECT 1 FROM trust_score WHERE user_id = t.u)`,
        [finleyId, morganId]
    );
    console.log('  ✓ Trust scores reset to 75, public_trust_rating = NULL');

    // Reset moderation flags
    await pool.query(
        `UPDATE users
         SET trust_matching_restricted = false,
             trust_public_dates_only = false,
             premium_suspended = false,
             visibility_rank_penalty = 0,
             moderation_warning_logged = false
         WHERE user_id IN ($1, $2)`,
        [finleyId, morganId]
    );
    console.log('  ✓ Moderation flags reset');

    // Create fresh match
    const u1 = Math.min(finleyId, morganId);
    const u2 = Math.max(finleyId, morganId);

    const matchResult = await pool.query(
        `INSERT INTO matches (user1_id, user2_id, match_status, matched_at)
         VALUES ($1, $2, 'active', NOW())
         RETURNING match_id`,
        [u1, u2]
    );
    const matchId = matchResult.rows[0].match_id;
    console.log(`  ✓ Created match: match_id=${matchId}`);


    // Seed past date 1 — 14 days ago
    const pastDate1 = await pool.query(
        `INSERT INTO date_scheduling
           (match_id, proposed_datetime, venue_type, venue_name,
            status, created_at, scheduled_end_at)
         VALUES ($1, NOW() - INTERVAL '14 days', 'public', 'Millennium Park',
            'approved', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days')
         RETURNING schedule_id`,
        [matchId]
    );
    const pastSched1 = pastDate1.rows[0].schedule_id;
    await pool.query(
        `INSERT INTO post_date_checkin
           (schedule_id, reviewer_user_id, reviewed_user_id,
            comfort_level, felt_safe, boundaries_respected,
            felt_pressured, would_meet_again, created_at)
         VALUES ($1, $2, $3, 5, true, true, false, 'Yes', NOW() - INTERVAL '14 days')`,
        [pastSched1, morganId, finleyId]
    );
    console.log(`  ✓ Past date 1 seeded (schedule_id=${pastSched1})`);

    // Seed past date 2 — 7 days ago
    const pastDate2 = await pool.query(
        `INSERT INTO date_scheduling
           (match_id, proposed_datetime, venue_type, venue_name,
            status, created_at, scheduled_end_at)
         VALUES ($1, NOW() - INTERVAL '7 days', 'public', 'Piccolo Sogno',
            'approved', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days')
         RETURNING schedule_id`,
        [matchId]
    );
    const pastSched2 = pastDate2.rows[0].schedule_id;
    await pool.query(
        `INSERT INTO post_date_checkin
           (schedule_id, reviewer_user_id, reviewed_user_id,
            comfort_level, felt_safe, boundaries_respected,
            felt_pressured, would_meet_again, created_at)
         VALUES ($1, $2, $3, 4, true, true, false, 'Yes', NOW() - INTERVAL '7 days')`,
        [pastSched2, morganId, finleyId]
    );
    console.log(`  ✓ Past date 2 seeded (schedule_id=${pastSched2})`);
    console.log(`  ✓ Finley now has 2 dates reviewed — one more triggers public rating`);

    // Create live demo date
    const liveDateResult = await pool.query(
        `INSERT INTO date_scheduling
           (match_id, proposed_datetime, venue_type, venue_name,
            status, created_at, scheduled_end_at)
         VALUES ($1, NOW() - INTERVAL '3 hours', 'public', 'Intelligentsia Coffee',
            'approved', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour')
         RETURNING schedule_id`,
        [matchId]
    );
    const liveScheduleId = liveDateResult.rows[0].schedule_id;
    console.log(`  ✓ Live demo date created: schedule_id=${liveScheduleId}`);


    // Pre-load notification into Morgan's bell
    await pool.query(
        `INSERT INTO notifications (user_id, type, payload, is_read, created_at)
         VALUES ($1, 'post_date_survey', $2, false, NOW())`,
        [
            morganId,
            JSON.stringify({
                schedule_id: liveScheduleId,
                venue_name: 'Intelligentsia Coffee'
            })
        ]
    );
    console.log(`  ✓ Survey notification loaded into Morgan's bell`);

    const finleyTrust = await pool.query(
        `SELECT internal_score, public_trust_rating 
     FROM trust_score WHERE user_id = $1`,
        [finleyId]
    );

    const finleyCheckins = await pool.query(
        `SELECT comfort_level, felt_safe, boundaries_respected, 
            felt_pressured, created_at
     FROM post_date_checkin
     WHERE reviewed_user_id = $1
     ORDER BY created_at ASC`,
        [finleyId]
    );

    console.log('\n' + '═'.repeat(62));
    console.log('═'.repeat(62));
    console.log(`  live schedule_id=${liveScheduleId}`);
    console.log(`  internal_score:      ${finleyTrust.rows[0].internal_score}`);
    console.log(`  public_trust_rating: ${finleyTrust.rows[0].public_trust_rating ?? 'NULL — New User'}`);
    console.log('  FINLEY PAST CHECK-INS:');
    finleyCheckins.rows.forEach((row, i) => {
        console.log(`  Date ${i + 1}: comfort=${row.comfort_level} safe=${row.felt_safe} boundaries=${row.boundaries_respected} pressured=${row.felt_pressured}`);
    });
    console.log('═'.repeat(62));


    await pool.end();
}

run().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});