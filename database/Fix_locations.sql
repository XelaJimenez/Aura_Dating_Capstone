-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: See all users and their current location data
-- Run this first to audit what needs fixing
-- ─────────────────────────────────────────────────────────────────────────────
SELECT user_id, first_name, last_name, location_city, location_state
FROM users
ORDER BY user_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Fix known seed users missing location_state
-- These are all the users from Aura_TestUsers_seed.sql that had only a city
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE users SET location_state = 'IL'
WHERE location_city = 'Chicago' AND (location_state IS NULL OR location_state = '');

UPDATE users SET location_state = 'TX'
WHERE location_city = 'Austin' AND (location_state IS NULL OR location_state = '');

UPDATE users SET location_state = 'CA'
WHERE location_city = 'Los Angeles' AND (location_state IS NULL OR location_state = '');


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Fix any user whose location_city contains a comma
-- (This handles cases where someone stored "Chicago, IL" in the city column)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE users
SET
    location_state = TRIM(SPLIT_PART(location_city, ',', 2)),
    location_city  = TRIM(SPLIT_PART(location_city, ',', 1))
WHERE location_city LIKE '%,%';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Verify — check for any remaining users with missing state
-- This should return 0 rows after fixes above
-- ─────────────────────────────────────────────────────────────────────────────
SELECT user_id, first_name, last_name, location_city, location_state
FROM users
WHERE location_state IS NULL OR location_state = ''
ORDER BY user_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Final audit — all users with clean City, State
-- ─────────────────────────────────────────────────────────────────────────────
SELECT user_id, first_name, last_name,
       location_city || ', ' || location_state AS location
FROM users
WHERE location_city IS NOT NULL
ORDER BY user_id;