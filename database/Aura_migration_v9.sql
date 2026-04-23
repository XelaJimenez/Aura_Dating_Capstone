-- v9: Permanently fix incomplete preference data for all test users
-- Fills in missing preference fields that were omitted in fix_users.sql
-- Uses ON CONFLICT DO UPDATE so this is safe to run multiple times

-- ── Fill missing fields on existing preference rows ──────────────────────────
UPDATE preferences
SET
    min_distance_miles         = COALESCE(min_distance_miles, 0),
    max_distance_miles         = COALESCE(max_distance_miles, 50),
    preferred_religion_type_id = COALESCE(preferred_religion_type_id, 6),
    preferred_smoking          = COALESCE(preferred_smoking, 2),
    preferred_drinking         = COALESCE(preferred_drinking, 3),
    preferred_coffee           = COALESCE(preferred_coffee, 1),
    preferred_diet             = COALESCE(preferred_diet, 1),
    preferred_activity_level   = COALESCE(preferred_activity_level, 3),
    preferred_music            = COALESCE(preferred_music, 1),
    preferred_family_oriented  = COALESCE(preferred_family_oriented, 1),
    preferred_isgamer          = COALESCE(preferred_isgamer, 1),
    preferred_isreader         = COALESCE(preferred_isreader, 1),
    preferred_travel_interest  = COALESCE(preferred_travel_interest, 1),
    preferred_pet_interest     = COALESCE(preferred_pet_interest, 1),
    preferred_personality_type = COALESCE(preferred_personality_type, 3)
WHERE user_id IN (2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 17, 18);

-- ── Ensure Marcus (12), Erika (16), Bhadie (17) have preference rows ─────────
INSERT INTO preferences (
    user_id,
    preferred_age_min, preferred_age_max,
    min_distance_miles, max_distance_miles,
    preferred_height_min, preferred_height_max,
    preferred_religion_type_id,
    preferred_smoking, preferred_drinking, preferred_coffee, preferred_diet,
    preferred_activity_level, preferred_music,
    preferred_family_oriented, preferred_isgamer, preferred_isreader,
    preferred_travel_interest, preferred_pet_interest,
    preferred_dating_goals, preferred_personality_type,
    preferred_want_children
)
VALUES
    (12, 18, 22, 0, 25, 60, 76, 6, 2, 1, 1, 1, 3, 2, 1, 1, 2, 1, 1, 2, 2, 1),
    (16, 18, 40, 0, 50, 60, 84, 6, 2, 3, 1, 1, 2, 1, 1, 2, 1, 2, 1, 2, 3, 1),
    (17, 33, 64, 0, 50, 60, 69, 1, 2, 2, 2, 3, 1, 2, 1, 3, 3, 3, 4, 1, 2, 3)
ON CONFLICT (user_id) DO UPDATE SET
    min_distance_miles         = COALESCE(preferences.min_distance_miles, EXCLUDED.min_distance_miles),
    max_distance_miles         = COALESCE(preferences.max_distance_miles, EXCLUDED.max_distance_miles),
    preferred_religion_type_id = COALESCE(preferences.preferred_religion_type_id, EXCLUDED.preferred_religion_type_id),
    preferred_smoking          = COALESCE(preferences.preferred_smoking, EXCLUDED.preferred_smoking),
    preferred_drinking         = COALESCE(preferences.preferred_drinking, EXCLUDED.preferred_drinking),
    preferred_coffee           = COALESCE(preferences.preferred_coffee, EXCLUDED.preferred_coffee),
    preferred_diet             = COALESCE(preferences.preferred_diet, EXCLUDED.preferred_diet),
    preferred_activity_level   = COALESCE(preferences.preferred_activity_level, EXCLUDED.preferred_activity_level),
    preferred_music            = COALESCE(preferences.preferred_music, EXCLUDED.preferred_music),
    preferred_family_oriented  = COALESCE(preferences.preferred_family_oriented, EXCLUDED.preferred_family_oriented),
    preferred_isgamer          = COALESCE(preferences.preferred_isgamer, EXCLUDED.preferred_isgamer),
    preferred_isreader         = COALESCE(preferences.preferred_isreader, EXCLUDED.preferred_isreader),
    preferred_travel_interest  = COALESCE(preferences.preferred_travel_interest, EXCLUDED.preferred_travel_interest),
    preferred_pet_interest     = COALESCE(preferences.preferred_pet_interest, EXCLUDED.preferred_pet_interest),
    preferred_personality_type = COALESCE(preferences.preferred_personality_type, EXCLUDED.preferred_personality_type);

-- ── Verify results ───────────────────────────────────────────────────────────
SELECT
    u.user_id,
    u.first_name,
    CASE WHEN p.min_distance_miles     IS NULL THEN 'MISSING' ELSE 'ok' END AS distance,
    CASE WHEN p.preferred_smoking      IS NULL THEN 'MISSING' ELSE 'ok' END AS smoking,
    CASE WHEN p.preferred_drinking     IS NULL THEN 'MISSING' ELSE 'ok' END AS drinking,
    CASE WHEN p.preferred_activity_level IS NULL THEN 'MISSING' ELSE 'ok' END AS activity,
    CASE WHEN p.preferred_music        IS NULL THEN 'MISSING' ELSE 'ok' END AS music,
    CASE WHEN p.preferred_personality_type IS NULL THEN 'MISSING' ELSE 'ok' END AS personality
FROM users u
LEFT JOIN preferences p ON p.user_id = u.user_id
WHERE u.email LIKE '%@test.com'
ORDER BY u.user_id;