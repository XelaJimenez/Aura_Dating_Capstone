-- v12: Fix Jordan and Riley demo users missing lat/lng and incomplete profile fields

UPDATE users SET
    latitude     = 41.878113,
    longitude    = -87.629799,
    coffee_id    = 1,
    gamer        = 2,
    reader       = 2,
    travel       = 2,
    pet_interest = 1,
    looking_for  = 'Looking for something real',
    astrology    = 3
WHERE user_id = 19;

UPDATE users SET
    latitude     = 41.878113,
    longitude    = -87.629799,
    coffee_id    = 1,
    gamer        = 2,
    reader       = 3,
    travel       = 2,
    pet_interest = 2,
    looking_for  = 'Looking for something real',
    astrology    = 5
WHERE user_id = 20;

-- Verify
SELECT user_id, first_name,
    CASE WHEN latitude  IS NULL THEN 'MISSING' ELSE 'ok' END AS lat,
    CASE WHEN longitude IS NULL THEN 'MISSING' ELSE 'ok' END AS lng,
    CASE WHEN coffee_id IS NULL THEN 'MISSING' ELSE 'ok' END AS coffee,
    CASE WHEN gamer     IS NULL THEN 'MISSING' ELSE 'ok' END AS gamer,
    CASE WHEN reader    IS NULL THEN 'MISSING' ELSE 'ok' END AS reader,
    CASE WHEN travel    IS NULL THEN 'MISSING' ELSE 'ok' END AS travel,
    CASE WHEN pet_interest IS NULL THEN 'MISSING' ELSE 'ok' END AS pet,
    CASE WHEN looking_for  IS NULL THEN 'MISSING' ELSE 'ok' END AS looking_for,
    CASE WHEN astrology    IS NULL THEN 'MISSING' ELSE 'ok' END AS astrology
FROM users
WHERE user_id IN (19, 20)
ORDER BY user_id;
