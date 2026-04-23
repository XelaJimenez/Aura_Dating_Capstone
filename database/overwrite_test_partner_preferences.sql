-- Overwrites partner-preference FKs for generic @test.com users (fixes rows stuck on
-- "No preference" because earlier patches only used COALESCE(..., NULL)).
-- Curated capstone demo accounts (seedCapstoneDemoUsers.js) are EXCLUDED — applying
-- user_id % N patterns to them breaks intentional partner prefs (e.g. Dante vs Beatrice).
-- Run: psql "$CONN" -f database/overwrite_test_partner_preferences.sql
-- Repair curated rows: database/repair_curated_capstone_partner_preferences.sql
-- Requires seed_data.sql + Aura_migrations_v4.sql (lookup labels must exist).

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
    )
FROM users u
WHERE p.user_id = u.user_id
  AND u.email LIKE '%@test.com'
  AND u.email NOT IN (
    'dante@test.com',
    'beatrice@test.com',
    'zendaya@test.com',
    'olivia@test.com',
    'shane@test.com',
    'priya@test.com',
    'tyler@test.com',
    'sandra@test.com',
    'jasmine@test.com',
    'derek@test.com',
    'finley@test.com',
    'avery@test.com',
    'kendall@test.com',
    'reese@test.com',
    'morgan@test.com'
  );
