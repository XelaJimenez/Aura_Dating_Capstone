CREATE TABLE "sexual_orientation" (
  "sexual_orientation_id" serial PRIMARY KEY,
  "sexual_orientation" varchar UNIQUE
);

CREATE TABLE "political_affil" (
  "political_affil_id" serial PRIMARY KEY,
  "political_affil" varchar UNIQUE
);

CREATE TABLE "want_children" (
  "want_children_id" serial PRIMARY KEY,
  "want_children" varchar UNIQUE
);

CREATE TABLE "astrology_sign" (
  "astrology_sign_id" serial PRIMARY KEY,
  "astrology_sign" varchar UNIQUE
);

CREATE TABLE "personality_type" (
  "personality_type_id" serial PRIMARY KEY,
  "personality_type_name" varchar UNIQUE
);

CREATE TABLE "pet_interest" (
  "pet_interest_id" serial PRIMARY KEY,
  "pet_interest_name" varchar UNIQUE
);

CREATE TABLE "travel_interest" (
  "travel_interest_id" serial PRIMARY KEY,
  "travel_interest_name" varchar UNIQUE
);

CREATE TABLE "reader" (
  "isreader_id" serial PRIMARY KEY,
  "isreader_name" varchar UNIQUE
);

CREATE TABLE "gamer" (
  "isgamer_id" serial PRIMARY KEY,
  "isgamer_name" varchar UNIQUE
);

CREATE TABLE "music" (
  "music_id" serial PRIMARY KEY,
  "music_name" varchar UNIQUE
);

CREATE TABLE "activity_level" (
  "activity_level_id" serial PRIMARY KEY,
  "activity_name" varchar UNIQUE
);

CREATE TABLE "diet" (
  "diet_id" serial PRIMARY KEY,
  "diet_name" varchar UNIQUE
);

CREATE TABLE "drinking" (
  "drinking_id" serial PRIMARY KEY,
  "drinking_name" varchar UNIQUE
);

CREATE TABLE "coffee_drinker" (
  "coffee_id" serial PRIMARY KEY,
  "coffee_name" varchar UNIQUE
);

CREATE TABLE "smoking" (
  "smoking_id" serial PRIMARY KEY,
  "smoking_name" varchar UNIQUE
);

CREATE TABLE "dating_goals" (
  "dating_goals_id" serial PRIMARY KEY,
  "dating_goal_name" varchar UNIQUE
);

CREATE TABLE "ethnicity_type" (
  "ethnicity_type_id" serial PRIMARY KEY,
  "ethnicity_name" varchar UNIQUE
);

CREATE TABLE "language" (
  "language_type_id" serial PRIMARY KEY,
  "language_name" varchar UNIQUE
);

CREATE TABLE "education_career" (
  "education_career_id" serial PRIMARY KEY,
  "education_career_name" varchar UNIQUE
);

CREATE TABLE "family_oriented" (
  "family_oriented_id" serial PRIMARY KEY,
  "family_oriented_name" varchar UNIQUE
);

CREATE TABLE "religion_type" (
  "religion_type_id" serial PRIMARY KEY,
  "religion_name" varchar UNIQUE
);

CREATE TABLE "gender_type" (
  "gender_type_id" serial PRIMARY KEY,
  "gender_name" varchar UNIQUE
);

CREATE TABLE "users" (
  "user_id" serial PRIMARY KEY,
  "first_name" varchar,
  "last_name" varchar,
  "email" varchar,
  "password_hash" varchar,
  "date_of_birth" date,
  "pronouns" varchar,
  "gender_identity" integer,
  "sexual_orientation" integer,
  "bio" text,
  "profile_photo_url" varchar,
  "location_city" varchar,
  "location_state" varchar,
  "latitude" decimal(9,6),
  "longitude" decimal(9,6),
  "account_status" varchar,
  "created_at" timestamptz,
  "last_login" timestamptz,
  "height_cm" integer,
  "religion_id" integer,
  "role_id" integer,
  "tier_id" integer,
  "ethnicity_id" integer,
  "language_id" integer,
  "education_career_id" integer,
  "smoking_id" integer,
  "drinking_id" integer,
  "coffee_id" integer,
  "diet_id" integer,
  "activity_level" integer,
  "family_oriented" integer,
  "music" int,
  "gamer" int,
  "reader" int,
  "travel" int,
  "pet_interest" int,
  "personality_type" int,
  "dating_goals" int,
  "looking_for" text,
  "astrology" int,
  "children" int,
  "political" int
);

CREATE TABLE "preferences" (
  "preference_id" serial PRIMARY KEY,
  "user_id" integer,
  "preferred_age_min" int,
  "preferred_age_max" int,
  "preferred_gender" integer,
  "min_distance_miles" int,
  "max_distance_miles" int,
  "preferred_height_min" integer,
  "preferred_height_max" integer,
  "preferred_religion_type_id" integer,
  "preferred_smoking" integer,
  "preferred_drinking" integer,
  "preferred_coffee" integer,
  "preferred_diet" integer,
  "preferred_activity_level" integer,
  "preferred_music" integer,
  "preferred_family_oriented" integer,
  "preferred_isgamer" integer,
  "preferred_isreader" integer,
  "preferred_travel_interest" integer,
  "preferred_pet_interest" integer,
  "preferred_dating_goals" integer,
  "preferred_personality_type" integer,
  "preferred_astrology_sign" integer,
  "preferred_want_children" integer,
  "preferred_political_affil" integer
);

CREATE TABLE "matches" (
  "match_id" serial PRIMARY KEY,
  "user1_id" integer,
  "user2_id" integer,
  "match_score" decimal,
  "matched_at" timestamptz,
  "match_status" varchar
);

CREATE TABLE "message" (
  "message_id" serial PRIMARY KEY,
  "match_id" integer,
  "sender_id" integer,
  "content" text,
  "sent_at" timestamptz,
  "read_at" timestamptz,
  "flagged_for_review" boolean
);

CREATE TABLE "reports" (
  "report_id" serial PRIMARY KEY,
  "reported_user_id" integer,
  "reporter_user_id" integer,
  "reason" varchar,
  "description" text,
  "evidence_url" varchar,
  "status" varchar,
  "created_at" timestamptz
);

CREATE TABLE "blocks" (
  "block_id" serial PRIMARY KEY,
  "blocker_user_id" integer,
  "blocked_user_id" integer,
  "blocked_at" timestamptz
);

CREATE TABLE "swipes" (
  "swipe_id" serial PRIMARY KEY,
  "swipe_user_id" integer,
  "swiped_user_id" integer,
  "swipe_type" varchar,
  "created_at" timestamptz
);

CREATE TABLE "photo" (
  "photo_id" serial PRIMARY KEY,
  "user_id" integer,
  "photo_url" varchar,
  "is_primary" boolean,
  "uploaded_at" timestamptz
);

CREATE TABLE "moderation" (
  "action_id" serial PRIMARY KEY,
  "admin_id" integer,
  "user_id" integer,
  "action_type" varchar,
  "reason" varchar,
  "action_date" timestamptz
);

CREATE TABLE "subscription_tiers" (
  "tier_id" serial PRIMARY KEY,
  "tier_name" varchar UNIQUE,
  "max_dates_per_week" integer
);

CREATE TABLE "roles" (
  "role_id" serial PRIMARY KEY,
  "role_name" varchar UNIQUE
);

CREATE TABLE "verification" (
  "verification_id" serial PRIMARY KEY,
  "user_id" integer,
  "action_type" varchar,
  "is_verified" boolean,
  "verified_at" timestamptz
);

CREATE TABLE "conversation_safety_state" (
  "state_id" serial PRIMARY KEY,
  "match_id" integer UNIQUE,
  "current_state" varchar,
  "consent_proxy_score" decimal,
  "unanswered_count" integer DEFAULT 0,
  "repeat_request_count" integer DEFAULT 0,
  "resistance_count" integer DEFAULT 0,
  "escalation_level" varchar,
  "last_updated" timestamptz,
  "engine_snapshot" jsonb
);

CREATE TABLE "trust_score" (
  "trust_score_id" serial PRIMARY KEY,
  "user_id" integer,
  "internal_score" integer,
  "last_updated" timestamptz
);

CREATE TABLE "date_scheduling" (
  "schedule_id" serial PRIMARY KEY,
  "match_id" integer,
  "porposed_datetime" timestamptz,
  "venue_type" varchar,
  "status" varchar,
  "rejection_reason" varchar,
  "created_at" timestamptz
);

CREATE TABLE "post_date_checkin" (
  "checkin_id" serial PRIMARY KEY,
  "schedule_id" integer,
  "reviewer_user_id" integer,
  "reviewed_user_id" integer,
  "comfort_level" integer,
  "felt_safe" boolean,
  "boundaries_respected" boolean,
  "felt_pressured" boolean,
  "would_meet_again" boolean,
  "created_at" timestamptz
);

CREATE UNIQUE INDEX ON "matches" ("user1_id", "user2_id");

CREATE UNIQUE INDEX ON "blocks" ("blocker_user_id", "blocked_user_id");

COMMENT ON COLUMN "preferences"."preferred_height_min" IS 'in cm';

COMMENT ON COLUMN "preferences"."preferred_height_max" IS 'in cm';

COMMENT ON COLUMN "reports"."reason" IS 'harassement, spam, hate speech';

COMMENT ON COLUMN "reports"."status" IS 'pending, reviewed, resolved';

COMMENT ON COLUMN "swipes"."swipe_type" IS 'like, dislike, superlike';

COMMENT ON TABLE "moderation" IS 'Admin safety System';

COMMENT ON COLUMN "moderation"."action_type" IS 'warning, mute, suspension, ban';

COMMENT ON COLUMN "subscription_tiers"."tier_name" IS 'free, premium';

COMMENT ON COLUMN "subscription_tiers"."max_dates_per_week" IS 'free = 3, premium = 5 per Feature 4 spec';

COMMENT ON COLUMN "roles"."role_name" IS 'user, moderator, admin';

COMMENT ON TABLE "verification" IS 'trust feature';

COMMENT ON COLUMN "verification"."action_type" IS 'email, phone, ID';

COMMENT ON COLUMN "trust_score"."internal_score" IS '0 to 100';

COMMENT ON COLUMN "date_scheduling"."venue_type" IS 'public etc';

COMMENT ON COLUMN "date_scheduling"."status" IS 'approved';

COMMENT ON COLUMN "post_date_checkin"."comfort_level" IS '1-5';

ALTER TABLE "users" ADD FOREIGN KEY ("gender_identity") REFERENCES "gender_type" ("gender_type_id");

ALTER TABLE "users" ADD FOREIGN KEY ("sexual_orientation") REFERENCES "sexual_orientation" ("sexual_orientation_id");

ALTER TABLE "users" ADD FOREIGN KEY ("religion_id") REFERENCES "religion_type" ("religion_type_id");

ALTER TABLE "users" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("role_id");

ALTER TABLE "users" ADD FOREIGN KEY ("tier_id") REFERENCES "subscription_tiers" ("tier_id");

ALTER TABLE "users" ADD FOREIGN KEY ("ethnicity_id") REFERENCES "ethnicity_type" ("ethnicity_type_id");

ALTER TABLE "users" ADD FOREIGN KEY ("language_id") REFERENCES "language" ("language_type_id");

ALTER TABLE "users" ADD FOREIGN KEY ("education_career_id") REFERENCES "education_career" ("education_career_id");

ALTER TABLE "users" ADD FOREIGN KEY ("smoking_id") REFERENCES "smoking" ("smoking_id");

ALTER TABLE "users" ADD FOREIGN KEY ("drinking_id") REFERENCES "drinking" ("drinking_id");

ALTER TABLE "users" ADD FOREIGN KEY ("coffee_id") REFERENCES "coffee_drinker" ("coffee_id");

ALTER TABLE "users" ADD FOREIGN KEY ("diet_id") REFERENCES "diet" ("diet_id");

ALTER TABLE "users" ADD FOREIGN KEY ("activity_level") REFERENCES "activity_level" ("activity_level_id");

ALTER TABLE "users" ADD FOREIGN KEY ("family_oriented") REFERENCES "family_oriented" ("family_oriented_id");

ALTER TABLE "users" ADD FOREIGN KEY ("music") REFERENCES "music" ("music_id");

ALTER TABLE "users" ADD FOREIGN KEY ("gamer") REFERENCES "gamer" ("isgamer_id");

ALTER TABLE "users" ADD FOREIGN KEY ("reader") REFERENCES "reader" ("isreader_id");

ALTER TABLE "users" ADD FOREIGN KEY ("travel") REFERENCES "travel_interest" ("travel_interest_id");

ALTER TABLE "users" ADD FOREIGN KEY ("pet_interest") REFERENCES "pet_interest" ("pet_interest_id");

ALTER TABLE "users" ADD FOREIGN KEY ("personality_type") REFERENCES "personality_type" ("personality_type_id");

ALTER TABLE "users" ADD FOREIGN KEY ("dating_goals") REFERENCES "dating_goals" ("dating_goals_id");

ALTER TABLE "users" ADD FOREIGN KEY ("astrology") REFERENCES "astrology_sign" ("astrology_sign_id");

ALTER TABLE "users" ADD FOREIGN KEY ("children") REFERENCES "want_children" ("want_children_id");

ALTER TABLE "users" ADD FOREIGN KEY ("political") REFERENCES "political_affil" ("political_affil_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_gender") REFERENCES "gender_type" ("gender_type_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_religion_type_id") REFERENCES "religion_type" ("religion_type_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_smoking") REFERENCES "smoking" ("smoking_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_drinking") REFERENCES "drinking" ("drinking_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_coffee") REFERENCES "coffee_drinker" ("coffee_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_diet") REFERENCES "diet" ("diet_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_activity_level") REFERENCES "activity_level" ("activity_level_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_music") REFERENCES "music" ("music_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_family_oriented") REFERENCES "family_oriented" ("family_oriented_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_isgamer") REFERENCES "gamer" ("isgamer_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_isreader") REFERENCES "reader" ("isreader_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_travel_interest") REFERENCES "travel_interest" ("travel_interest_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_pet_interest") REFERENCES "pet_interest" ("pet_interest_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_dating_goals") REFERENCES "dating_goals" ("dating_goals_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_personality_type") REFERENCES "personality_type" ("personality_type_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_astrology_sign") REFERENCES "astrology_sign" ("astrology_sign_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_want_children") REFERENCES "want_children" ("want_children_id");

ALTER TABLE "preferences" ADD FOREIGN KEY ("preferred_political_affil") REFERENCES "political_affil" ("political_affil_id");

ALTER TABLE "matches" ADD FOREIGN KEY ("user1_id") REFERENCES "users" ("user_id");

ALTER TABLE "matches" ADD FOREIGN KEY ("user2_id") REFERENCES "users" ("user_id");

ALTER TABLE "message" ADD FOREIGN KEY ("match_id") REFERENCES "matches" ("match_id");

ALTER TABLE "message" ADD FOREIGN KEY ("sender_id") REFERENCES "users" ("user_id");

ALTER TABLE "reports" ADD FOREIGN KEY ("reported_user_id") REFERENCES "users" ("user_id");

ALTER TABLE "reports" ADD FOREIGN KEY ("reporter_user_id") REFERENCES "users" ("user_id");

ALTER TABLE "blocks" ADD FOREIGN KEY ("blocker_user_id") REFERENCES "users" ("user_id");

ALTER TABLE "blocks" ADD FOREIGN KEY ("blocked_user_id") REFERENCES "users" ("user_id");

ALTER TABLE "swipes" ADD FOREIGN KEY ("swipe_user_id") REFERENCES "users" ("user_id");

ALTER TABLE "swipes" ADD FOREIGN KEY ("swiped_user_id") REFERENCES "users" ("user_id");

ALTER TABLE "photo" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "moderation" ADD FOREIGN KEY ("admin_id") REFERENCES "users" ("user_id");

ALTER TABLE "moderation" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "verification" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "conversation_safety_state" ADD FOREIGN KEY ("match_id") REFERENCES "matches" ("match_id");

ALTER TABLE "trust_score" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

ALTER TABLE "date_scheduling" ADD FOREIGN KEY ("match_id") REFERENCES "matches" ("match_id");

ALTER TABLE "post_date_checkin" ADD FOREIGN KEY ("schedule_id") REFERENCES "date_scheduling" ("schedule_id");

ALTER TABLE "post_date_checkin" ADD FOREIGN KEY ("reviewer_user_id") REFERENCES "users" ("user_id");

ALTER TABLE "post_date_checkin" ADD FOREIGN KEY ("reviewed_user_id") REFERENCES "users" ("user_id");
