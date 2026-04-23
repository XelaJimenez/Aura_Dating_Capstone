BEGIN;

UPDATE users SET ethnicity_id = 1, education_career_id = 3 WHERE user_id = 18;

UPDATE users SET height_inches = 71, ethnicity_id = 8, education_career_id = 5, family_oriented = 3, political = 4 WHERE user_id = 19;

UPDATE users SET height_inches = 64, ethnicity_id = 8, education_career_id = 5, family_oriented = 2, political = 3 WHERE user_id = 20;

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (2, 22, 32, 67, 78, 3, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 2), 2);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (3, 22, 35, 66, 78, 3, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 3), 2);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (4, 22, 35, 66, 78, 3, 4);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 4), 2);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (5, 22, 35, 66, 78, 3, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 5), 2);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (6, 22, 35, 65, 78, 3, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 6), 2);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (7, 22, 35, 60, 72, 3, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 7), 3);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (8, 40, 60, 66, 78, 3, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 8), 2);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (9, 22, 35, 66, 78, 3, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 9), 2);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (10, 22, 35, 60, 72, 3, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 10), 3);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (18, 22, 35, 66, 78, 3, 2);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 18), 2);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (19, 20, 30, 60, 72, 2, 1);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 19), 3);

INSERT INTO preferences (user_id, preferred_age_min, preferred_age_max, preferred_height_min, preferred_height_max, preferred_dating_goals, preferred_want_children) VALUES (20, 22, 32, 66, 78, 2, 4);
INSERT INTO preference_genders (preference_id, gender_type_id) VALUES ((SELECT preference_id FROM preferences WHERE user_id = 20), 2);

COMMIT;

SELECT u.user_id, u.first_name, u.last_name,
    CASE WHEN u.ethnicity_id IS NULL THEN 'MISSING' ELSE 'ok' END AS ethnicity,
    CASE WHEN u.education_career_id IS NULL THEN 'MISSING' ELSE 'ok' END AS education,
    CASE WHEN u.family_oriented IS NULL THEN 'MISSING' ELSE 'ok' END AS family,
    CASE WHEN u.political IS NULL THEN 'MISSING' ELSE 'ok' END AS political,
    CASE WHEN u.height_inches IS NULL THEN 'MISSING' ELSE 'ok' END AS height,
    CASE WHEN p.preference_id IS NULL THEN 'MISSING' ELSE 'ok' END AS has_prefs
FROM users u
LEFT JOIN preferences p ON p.user_id = u.user_id
ORDER BY u.user_id;
