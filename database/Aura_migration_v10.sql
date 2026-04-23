-- v10: Fix missing preference_genders and missing lat/lng for test users

-- ── Fix missing lat/lng ───────────────────────────────────────────────────────
UPDATE users SET latitude = 41.878113, longitude = -87.629799
WHERE user_id = 16 AND (latitude IS NULL OR longitude IS NULL);

UPDATE users SET latitude = 41.878113, longitude = -87.629799
WHERE user_id = 18 AND (latitude IS NULL OR longitude IS NULL);

-- ── Fix missing preference_genders for Marcus (12), Erika (16), Bhadie (17) ──
INSERT INTO preference_genders (preference_id, gender_type_id)
SELECT p.preference_id, 3
FROM preferences p
WHERE p.user_id = 12
AND NOT EXISTS (
    SELECT 1 FROM preference_genders pg WHERE pg.preference_id = p.preference_id
);

INSERT INTO preference_genders (preference_id, gender_type_id)
SELECT p.preference_id, 2
FROM preferences p
WHERE p.user_id = 16
AND NOT EXISTS (
    SELECT 1 FROM preference_genders pg WHERE pg.preference_id = p.preference_id
);

INSERT INTO preference_genders (preference_id, gender_type_id)
SELECT p.preference_id, 2
FROM preferences p
WHERE p.user_id = 17
AND NOT EXISTS (
    SELECT 1 FROM preference_genders pg WHERE pg.preference_id = p.preference_id
);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT
    u.user_id,
    u.first_name,
    CASE WHEN u.latitude  IS NULL THEN 'MISSING' ELSE 'ok' END AS lat,
    CASE WHEN u.longitude IS NULL THEN 'MISSING' ELSE 'ok' END AS lng,
    CASE WHEN pg.gender_type_id IS NULL THEN 'MISSING' ELSE 'ok' END AS gender_pref
FROM users u
LEFT JOIN preferences p ON p.user_id = u.user_id
LEFT JOIN preference_genders pg ON pg.preference_id = p.preference_id
WHERE u.email LIKE '%@test.com'
ORDER BY u.user_id;
