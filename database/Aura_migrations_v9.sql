-- Aura_migrations_v9.sql
-- Replaces the old varchar time_slot user_availability with a proper
-- structured table that supports range-based unavailability checks.

DROP TABLE IF EXISTS user_availability;

CREATE TABLE user_availability (
    availability_id  serial PRIMARY KEY,
    user_id          integer      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    day_of_week      varchar(9)   NOT NULL,
    start_time       time         NOT NULL,
    end_time         time         NOT NULL,
    created_at       timestamptz  DEFAULT NOW(),
    CONSTRAINT chk_availability_day CHECK (
        day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')
    ),
    CONSTRAINT chk_availability_times CHECK (end_time > start_time)
);

CREATE INDEX idx_user_availability_user ON user_availability(user_id);
CREATE INDEX idx_user_availability_day  ON user_availability(user_id, day_of_week);