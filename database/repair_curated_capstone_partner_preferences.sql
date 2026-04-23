-- Restores partner preferences for capstone demo accounts to match scripts/seedCapstoneDemoUsers.js.
-- Run after a destructive overwrite (e.g. database/overwrite_test_partner_preferences.sql) that
-- was applied before that script excluded curated emails.
--
--   node scripts/run-sql.js database/repair_curated_capstone_partner_preferences.sql

BEGIN;

-- ── Dante ───────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 22,
    preferred_age_max = 40,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 58,
    preferred_height_max = 76,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Christian' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Open' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'dante@test.com';

-- ── Beatrice ────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 24,
    preferred_age_max = 35,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 60,
    preferred_height_max = 74,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Christian' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Want kids' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'High' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'beatrice@test.com';

-- ── Zendaya ─────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 23,
    preferred_age_max = 38,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 60,
    preferred_height_max = 72,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'No preference' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'No preference' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'No preference' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Serious' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'No preference' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'zendaya@test.com';

-- ── Olivia ──────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 21,
    preferred_age_max = 32,
    min_distance_miles = 0,
    max_distance_miles = 40,
    preferred_height_min = 60,
    preferred_height_max = 70,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'No preference' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'White / Caucasian' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Don''t want kids' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'High' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'No' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'olivia@test.com';

-- ── Shane ───────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 22,
    preferred_age_max = 35,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 60,
    preferred_height_max = 74,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Christian' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Asian' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Want kids' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'shane@test.com';

-- ── Priya ────────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 25,
    preferred_age_max = 40,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 62,
    preferred_height_max = 72,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Hindu' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Asian' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Liberal' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Open' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Serious' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'High' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'priya@test.com';

-- ── Tyler ───────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 22,
    preferred_age_max = 35,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 62,
    preferred_height_max = 70,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'No preference' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'No preference' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Want kids' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'High' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'tyler@test.com';

-- ── Sandra ──────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 45,
    preferred_age_max = 60,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 60,
    preferred_height_max = 74,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'No preference' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Don''t want kids' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'No' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'sandra@test.com';

-- ── Jasmine ─────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 24,
    preferred_age_max = 36,
    min_distance_miles = 0,
    max_distance_miles = 25,
    preferred_height_min = 62,
    preferred_height_max = 72,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'No preference' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Hispanic / Latino' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Liberal' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Open' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Serious' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'High' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'jasmine@test.com';

-- ── Derek ───────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 22,
    preferred_age_max = 40,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 60,
    preferred_height_max = 74,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Christian' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Open' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'derek@test.com';

-- ── Finley ──────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 24,
    preferred_age_max = 38,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 60,
    preferred_height_max = 72,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'No preference' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Open' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Serious' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'finley@test.com';

-- ── Avery ───────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 25,
    preferred_age_max = 36,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 62,
    preferred_height_max = 74,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Christian' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Asian' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Want kids' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'High' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'avery@test.com';

-- ── Kendall ─────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 21,
    preferred_age_max = 30,
    min_distance_miles = 0,
    max_distance_miles = 40,
    preferred_height_min = 60,
    preferred_height_max = 72,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'No preference' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Liberal' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Don''t want kids' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Casual' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'No' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'kendall@test.com';

-- ── Reese ────────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 22,
    preferred_age_max = 40,
    min_distance_miles = 0,
    max_distance_miles = 50,
    preferred_height_min = 60,
    preferred_height_max = 72,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'No preference' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'No preference' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'No preference' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Serious' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Low' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'No preference' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'reese@test.com';

-- ── Morgan ──────────────────────────────────────────────────────────────────
UPDATE preferences p
SET
    preferred_age_min = 24,
    preferred_age_max = 38,
    min_distance_miles = 0,
    max_distance_miles = 100,
    preferred_height_min = 62,
    preferred_height_max = 74,
    preferred_religion_type_id = (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Christian' LIMIT 1),
    preferred_ethnicity_id = (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'No preference' LIMIT 1),
    preferred_political_affil = (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1),
    preferred_want_children = (SELECT want_children_id FROM want_children WHERE want_children = 'Open' LIMIT 1),
    preferred_dating_goals = (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1),
    preferred_activity_level = (SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1),
    preferred_family_oriented = (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
FROM users u
WHERE p.user_id = u.user_id AND u.email = 'morgan@test.com';

-- ── preference_genders (multi-select) ───────────────────────────────────────
DELETE FROM preference_genders pg
USING preferences p
JOIN users u ON u.user_id = p.user_id
WHERE pg.preference_id = p.preference_id
  AND u.email IN (
    'dante@test.com', 'beatrice@test.com', 'zendaya@test.com', 'olivia@test.com',
    'shane@test.com', 'priya@test.com', 'tyler@test.com', 'sandra@test.com',
    'jasmine@test.com', 'derek@test.com', 'finley@test.com', 'avery@test.com',
    'kendall@test.com', 'reese@test.com', 'morgan@test.com'
  );

INSERT INTO preference_genders (preference_id, gender_type_id)
SELECT p.preference_id, g.gender_type_id
FROM preferences p
JOIN users u ON u.user_id = p.user_id
CROSS JOIN (VALUES
    ('dante@test.com', 'Non-binary'),
    ('beatrice@test.com', 'Woman'),
    ('zendaya@test.com', 'Woman'),
    ('zendaya@test.com', 'Non-binary'),
    ('olivia@test.com', 'Non-binary'),
    ('shane@test.com', 'Non-binary'),
    ('priya@test.com', 'Woman'),
    ('priya@test.com', 'Non-binary'),
    ('tyler@test.com', 'Woman'),
    ('sandra@test.com', 'Non-binary'),
    ('sandra@test.com', 'Woman'),
    ('jasmine@test.com', 'Non-binary'),
    ('derek@test.com', 'Non-binary'),
    ('finley@test.com', 'Non-binary'),
    ('finley@test.com', 'Woman'),
    ('avery@test.com', 'Woman'),
    ('avery@test.com', 'Non-binary'),
    ('kendall@test.com', 'Non-binary'),
    ('reese@test.com', 'Non-binary'),
    ('morgan@test.com', 'Non-binary'),
    ('morgan@test.com', 'Woman')
) AS v(email, gender_name)
JOIN gender_type g ON g.gender_name = v.gender_name
WHERE u.email = v.email
ON CONFLICT DO NOTHING;

COMMIT;
