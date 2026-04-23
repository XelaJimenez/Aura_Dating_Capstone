-- Feature 2: Post-date safety trust, moderation flags, appeals, survey timing

-- Completed date end time (survey fires 1 minute after this)
ALTER TABLE date_scheduling
    ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

-- Public + moderation fields on trust_score
ALTER TABLE trust_score
    ADD COLUMN IF NOT EXISTS public_trust_rating numeric(4, 2),
    ADD COLUMN IF NOT EXISTS trust_frozen_until timestamptz,
    ADD COLUMN IF NOT EXISTS freeze_reason varchar(64);

-- User-level trust / moderation (visibility, matching, premium)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS trust_public_dates_only boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS trust_matching_restricted boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS premium_suspended boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS visibility_rank_penalty integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS moderation_warning_logged boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS appeal_count_90d integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS appeal_frivolous_strikes integer DEFAULT 0;

-- One check-in per reviewer per scheduled date
CREATE UNIQUE INDEX IF NOT EXISTS uq_post_date_checkin_schedule_reviewer
    ON post_date_checkin (schedule_id, reviewer_user_id)
    WHERE schedule_id IS NOT NULL;

-- Safety events for pattern detection (pressure, unsafe, boundary)
CREATE TABLE IF NOT EXISTS trust_safety_events (
    event_id       serial PRIMARY KEY,
    subject_user_id integer NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    checkin_id      integer REFERENCES post_date_checkin (checkin_id) ON DELETE SET NULL,
    event_type      varchar(32) NOT NULL,
    created_at      timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_safety_events_subject_time
    ON trust_safety_events (subject_user_id, created_at DESC);

-- Moderation actions applied by the system (appealable)
CREATE TABLE IF NOT EXISTS moderation_actions (
    action_id       serial PRIMARY KEY,
    user_id         integer NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    action_type     varchar(64) NOT NULL,
    reason          text,
    active          boolean DEFAULT true,
    created_at      timestamptz DEFAULT NOW(),
    resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_user_active
    ON moderation_actions (user_id, active);

-- Appeals against system moderation only
CREATE TABLE IF NOT EXISTS moderation_appeals (
    appeal_id       serial PRIMARY KEY,
    user_id         integer NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    category        varchar(32) NOT NULL,
    explanation     varchar(320) NOT NULL,
    status          varchar(24) NOT NULL DEFAULT 'pending',
    outcome         varchar(32),
    related_action_id integer REFERENCES moderation_actions (action_id),
    created_at      timestamptz DEFAULT NOW(),
    resolved_at     timestamptz,
    reviewer_note   text
);

CREATE INDEX IF NOT EXISTS idx_moderation_appeals_user
    ON moderation_appeals (user_id, created_at DESC);

-- Backfill end times for already-approved dates (survey trigger uses scheduled_end_at)
UPDATE date_scheduling
SET scheduled_end_at = proposed_datetime + interval '2 hours'
WHERE status = 'approved'
  AND scheduled_end_at IS NULL;

UPDATE survey_trigger st
SET trigger_at = ds.scheduled_end_at + interval '1 minute'
FROM date_scheduling ds
WHERE ds.schedule_id = st.schedule_id
  AND st.sent = false
  AND ds.scheduled_end_at IS NOT NULL;
