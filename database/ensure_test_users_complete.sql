-- Run after seed_data.sql and Aura_migrations_v4.sql (adds "No preference" rows).
-- Resolves FKs by lookup name so IDs stay correct even if serial order differs.
-- Safe to run multiple times (uses NOT EXISTS for inserts).
--
-- IMPORTANT: Curated demo accounts from scripts/seedCapstoneDemoUsers.js are EXCLUDED below.
-- Running generic partner-pref updates against them overwrote Non-binary-only prefs and broke
-- matching (e.g. Dante vs Beatrice/Avery). Use `npm run db:seed:demo` to rebuild that roster.

-- Demo emails managed by seedCapstoneDemoUsers.js — do not generic-patch their preferences.
CREATE TEMP TABLE _curated_demo_email (email TEXT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _curated_demo_email (email) VALUES
    ('dante@test.com'),
    ('beatrice@test.com'),
    ('zendaya@test.com'),
    ('olivia@test.com'),
    ('shane@test.com'),
    ('priya@test.com'),
    ('tyler@test.com'),
    ('sandra@test.com'),
    ('jasmine@test.com'),
    ('derek@test.com'),
    ('finley@test.com'),
    ('avery@test.com'),
    ('kendall@test.com'),
    ('reese@test.com'),
    ('morgan@test.com');

INSERT INTO preferences (
    user_id,
    preferred_age_min,
    preferred_age_max,
    min_distance_miles,
    max_distance_miles,
    preferred_height_min,
    preferred_height_max
)
SELECT
    u.user_id,
    22,
    40,
    0,
    50,
    60,
    78
FROM users u
WHERE u.email LIKE '%@test.com'
  AND NOT EXISTS (SELECT 1 FROM preferences p WHERE p.user_id = u.user_id);

-- Own profile: ensure family/children defaults where missing (NULL only).
UPDATE users usr
SET
    family_oriented = COALESCE(
        usr.family_oriented,
        (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
    ),
    children = COALESCE(
        usr.children,
        (SELECT want_children_id FROM want_children WHERE want_children = 'Want kids' LIMIT 1)
    ),
    ethnicity_id = COALESCE(
        usr.ethnicity_id,
        (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Asian' LIMIT 1)
    )
WHERE usr.email LIKE '%@test.com';

-- Partner preferences: assign explicit values (not COALESCE — old rows may have
-- "No preference" FKs that still look like real IDs and would never be replaced).
UPDATE preferences p
SET
    preferred_religion_type_id = (
        CASE (u.user_id % 6)
            WHEN 0 THEN (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Christian' LIMIT 1)
            WHEN 1 THEN (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Hindu' LIMIT 1)
            WHEN 2 THEN (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Jewish' LIMIT 1)
            WHEN 3 THEN (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Muslim' LIMIT 1)
            WHEN 4 THEN (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Catholic' LIMIT 1)
            ELSE       (SELECT religion_type_id FROM religion_type WHERE religion_name = 'Buddhist' LIMIT 1)
        END
    ),
    preferred_ethnicity_id = (
        CASE (u.user_id % 5)
            WHEN 0 THEN (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Asian' LIMIT 1)
            WHEN 1 THEN (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'White / Caucasian' LIMIT 1)
            WHEN 2 THEN (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Hispanic / Latino' LIMIT 1)
            WHEN 3 THEN (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Black / African American' LIMIT 1)
            ELSE       (SELECT ethnicity_type_id FROM ethnicity_type WHERE ethnicity_name = 'Middle Eastern' LIMIT 1)
        END
    ),
    preferred_political_affil = (
        CASE (u.user_id % 4)
            WHEN 0 THEN (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Moderate' LIMIT 1)
            WHEN 1 THEN (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Liberal' LIMIT 1)
            WHEN 2 THEN (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Conservative' LIMIT 1)
            ELSE       (SELECT political_affil_id FROM political_affil WHERE political_affil = 'Apolitical' LIMIT 1)
        END
    ),
    preferred_family_oriented = (
        CASE (u.user_id % 2)
            WHEN 0 THEN (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'Yes' LIMIT 1)
            ELSE       (SELECT family_oriented_id FROM family_oriented WHERE family_oriented_name = 'No' LIMIT 1)
        END
    ),
    preferred_want_children = (
        CASE (u.user_id % 4)
            WHEN 0 THEN (SELECT want_children_id FROM want_children WHERE want_children = 'Want kids' LIMIT 1)
            WHEN 1 THEN (SELECT want_children_id FROM want_children WHERE want_children = 'Open' LIMIT 1)
            WHEN 2 THEN (SELECT want_children_id FROM want_children WHERE want_children = 'Have kids' LIMIT 1)
            ELSE       (SELECT want_children_id FROM want_children WHERE want_children = 'Don''t want kids' LIMIT 1)
        END
    ),
    preferred_dating_goals = (
        CASE (u.user_id % 3)
            WHEN 0 THEN (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Long-term' LIMIT 1)
            WHEN 1 THEN (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Serious' LIMIT 1)
            ELSE       (SELECT dating_goals_id FROM dating_goals WHERE dating_goal_name = 'Casual' LIMIT 1)
        END
    ),
    preferred_activity_level = (
        SELECT activity_level_id FROM activity_level WHERE activity_name = 'Medium' LIMIT 1
    )
FROM users u
WHERE p.user_id = u.user_id
  AND u.email LIKE '%@test.com'
  AND NOT EXISTS (SELECT 1 FROM _curated_demo_email c WHERE c.email = u.email);

-- One partner gender per test user (UI reads preferred_gender_ids[0]).
DELETE FROM preference_genders pg
USING preferences p, users u
WHERE pg.preference_id = p.preference_id
  AND p.user_id = u.user_id
  AND u.email LIKE '%@test.com'
  AND NOT EXISTS (SELECT 1 FROM _curated_demo_email c WHERE c.email = u.email);

INSERT INTO preference_genders (preference_id, gender_type_id)
SELECT
    p.preference_id,
    CASE ((u.user_id - 1) % 3)
        WHEN 0 THEN (SELECT gender_type_id FROM gender_type WHERE gender_name = 'Non-binary' LIMIT 1)
        WHEN 1 THEN (SELECT gender_type_id FROM gender_type WHERE gender_name = 'Man' LIMIT 1)
        ELSE       (SELECT gender_type_id FROM gender_type WHERE gender_name = 'Woman' LIMIT 1)
    END
FROM preferences p
JOIN users u ON u.user_id = p.user_id
WHERE u.email LIKE '%@test.com'
  AND NOT EXISTS (SELECT 1 FROM _curated_demo_email c WHERE c.email = u.email);
