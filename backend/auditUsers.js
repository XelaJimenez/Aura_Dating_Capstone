require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function run() {
    const { rows } = await pool.query(`
        SELECT
            u.user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.account_status,
            u.location_city,
            u.location_state,
            u.date_of_birth,
            u.height_inches,
            u.bio,
            u.tier_id,
            gt.gender_name,
            rt.religion_name,
            et.ethnicity_name,
            ec.education_career_name,
            fo.family_oriented_name,
            wc.want_children        AS children,
            dg.dating_goal_name     AS dating_goal,
            pa.political_affil      AS political,
            al.activity_name        AS activity,
            sm.smoking_name         AS smoking,
            dr.drinking_name        AS drinking,
            di.diet_name            AS diet,
            mu.music_name           AS music,
            ts.internal_score       AS trust_score,

            p.preferred_age_min,
            p.preferred_age_max,
            p.preferred_height_min,
            p.preferred_height_max,
            prt.religion_name       AS pref_religion,
            pdg.dating_goal_name    AS pref_dating_goal,
            pwc.want_children       AS pref_children,
            ppa.political_affil     AS pref_political,
            STRING_AGG(DISTINCT pgt.gender_name, ', ') AS pref_genders

        FROM users u
        LEFT JOIN gender_type       gt  ON gt.gender_type_id      = u.gender_identity
        LEFT JOIN religion_type     rt  ON rt.religion_type_id    = u.religion_id
        LEFT JOIN ethnicity_type    et  ON et.ethnicity_type_id   = u.ethnicity_id
        LEFT JOIN education_career  ec  ON ec.education_career_id = u.education_career_id
        LEFT JOIN family_oriented   fo  ON fo.family_oriented_id  = u.family_oriented
        LEFT JOIN want_children     wc  ON wc.want_children_id    = u.children
        LEFT JOIN dating_goals      dg  ON dg.dating_goals_id     = u.dating_goals
        LEFT JOIN political_affil   pa  ON pa.political_affil_id  = u.political
        LEFT JOIN activity_level    al  ON al.activity_level_id   = u.activity_level
        LEFT JOIN smoking           sm  ON sm.smoking_id          = u.smoking_id
        LEFT JOIN drinking          dr  ON dr.drinking_id         = u.drinking_id
        LEFT JOIN diet              di  ON di.diet_id             = u.diet_id
        LEFT JOIN music             mu  ON mu.music_id            = u.music
        LEFT JOIN trust_score       ts  ON ts.user_id             = u.user_id

        LEFT JOIN preferences       p   ON p.user_id              = u.user_id
        LEFT JOIN religion_type     prt ON prt.religion_type_id   = p.preferred_religion_type_id
        LEFT JOIN dating_goals      pdg ON pdg.dating_goals_id    = p.preferred_dating_goals
        LEFT JOIN want_children     pwc ON pwc.want_children_id   = p.preferred_want_children
        LEFT JOIN political_affil   ppa ON ppa.political_affil_id = p.preferred_political_affil
        LEFT JOIN preference_genders pg  ON pg.preference_id      = p.preference_id
        LEFT JOIN gender_type       pgt ON pgt.gender_type_id     = pg.gender_type_id

        GROUP BY
            u.user_id, gt.gender_name, rt.religion_name, et.ethnicity_name,
            ec.education_career_name, fo.family_oriented_name, wc.want_children,
            dg.dating_goal_name, pa.political_affil, al.activity_name,
            sm.smoking_name, dr.drinking_name, di.diet_name, mu.music_name,
            ts.internal_score,
            p.preferred_age_min, p.preferred_age_max,
            p.preferred_height_min, p.preferred_height_max,
            prt.religion_name, pdg.dating_goal_name, pwc.want_children,
            ppa.political_affil

        ORDER BY u.user_id
    `);

    const SEP = '─'.repeat(72);

    const flag = (val, label) => {
        if (val === null || val === undefined || val === '') return `  ⚠️  ${label}: MISSING`;
        return null;
    };

    rows.forEach(u => {
        const issues = [
            flag(u.location_city,  'location_city'),
            flag(u.location_state, 'location_state'),
            flag(u.email,          'email'),
            flag(u.gender_name,    'gender'),
            flag(u.date_of_birth,  'date_of_birth'),
        ].filter(Boolean);

        const hasIssues = issues.length > 0;
        const statusIcon = u.account_status === 'active' ? '✅' : '🚫';
        const locationOk = u.location_city && u.location_state;

        console.log(SEP);
        console.log(`USER #${u.user_id}  ${statusIcon} ${u.account_status?.toUpperCase()}${hasIssues ? '  ⚠️  HAS ISSUES' : ''}`);
        console.log(SEP);

        console.log(`  Name         : ${u.first_name || '?'} ${u.last_name || '?'}`);
        console.log(`  Email        : ${u.email || '⚠️  MISSING'}`);
        console.log(`  Password     : [hashed — use password123 or check seed file]`);
        console.log(`  Status       : ${u.account_status}`);
        console.log(`  Tier         : ${u.tier_id}`);
        console.log(`  Trust Score  : ${u.trust_score ?? '⚠️  MISSING'}`);
        console.log(`  DOB          : ${u.date_of_birth ? new Date(u.date_of_birth).toLocaleDateString() : '⚠️  MISSING'}`);
        console.log(`  Location     : ${locationOk ? `${u.location_city}, ${u.location_state}` : `⚠️  INVALID — city: "${u.location_city || ''}"  state: "${u.location_state || ''}"`}`);
        console.log(`  Height       : ${u.height_inches ? `${Math.floor(u.height_inches/12)}'${u.height_inches%12}"` : '—'}`);
        console.log(`  Gender       : ${u.gender_name || '⚠️  MISSING'}`);
        console.log(`  Religion     : ${u.religion_name || '—'}`);
        console.log(`  Ethnicity    : ${u.ethnicity_name || '—'}`);
        console.log(`  Education    : ${u.education_career_name || '—'}`);
        console.log(`  Family Orient: ${u.family_oriented_name || '—'}`);
        console.log(`  Children     : ${u.children || '—'}`);
        console.log(`  Dating Goal  : ${u.dating_goal || '—'}`);
        console.log(`  Political    : ${u.political || '—'}`);
        console.log(`  Activity     : ${u.activity || '—'}`);
        console.log(`  Smoking      : ${u.smoking || '—'}`);
        console.log(`  Drinking     : ${u.drinking || '—'}`);
        console.log(`  Diet         : ${u.diet || '—'}`);
        console.log(`  Music        : ${u.music || '—'}`);
        console.log(`  Bio          : ${u.bio || '—'}`);

        console.log(`\n  ── PREFERENCES ──`);
        if (u.preferred_age_min) {
            console.log(`  Age Range    : ${u.preferred_age_min} – ${u.preferred_age_max}`);
            console.log(`  Height Range : ${u.preferred_height_min ? `${Math.floor(u.preferred_height_min/12)}'${u.preferred_height_min%12}"` : '—'} – ${u.preferred_height_max ? `${Math.floor(u.preferred_height_max/12)}'${u.preferred_height_max%12}"` : '—'}`);
            console.log(`  Gender Pref  : ${u.pref_genders || 'No preference'}`);
            console.log(`  Religion Pref: ${u.pref_religion || '—'}`);
            console.log(`  Dating Goal P: ${u.pref_dating_goal || '—'}`);
            console.log(`  Children Pref: ${u.pref_children || '—'}`);
            console.log(`  Political Pref: ${u.pref_political || '—'}`);
        } else {
            console.log(`  No preferences set`);
        }

        if (hasIssues) {
            console.log(`\n  ── ⚠️  ISSUES ──`);
            issues.forEach(i => console.log(i));
        }

        console.log('');
    });

    console.log(SEP);
    console.log(`SUMMARY: ${rows.length} total users`);
    const invalid = rows.filter(u => !u.location_city || !u.location_state);
    if (invalid.length > 0) {
        console.log(`\n⚠️  USERS WITH INVALID/MISSING LOCATION (candidates for deletion):`);
        invalid.forEach(u => console.log(`   #${u.user_id}  ${u.first_name} ${u.last_name}  —  city: "${u.location_city || ''}"  state: "${u.location_state || ''}"`));
    } else {
        console.log(`✅  All users have valid location data`);
    }
    console.log(SEP);

    await pool.end();
}

run().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});