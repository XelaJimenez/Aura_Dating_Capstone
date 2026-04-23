-- Feature 3: full engine snapshot for consent/counters (survives process restarts)
ALTER TABLE conversation_safety_state
  ADD COLUMN IF NOT EXISTS engine_snapshot JSONB;

COMMENT ON COLUMN conversation_safety_state.engine_snapshot IS
  'Serialized conversation safety engine state (states, counters, timing, initiators).';
