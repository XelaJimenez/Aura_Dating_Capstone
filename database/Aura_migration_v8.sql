-- v8: Add preferred_ethnicity_id to preferences table
-- Required for ethnicity preference saving in profileController

ALTER TABLE preferences
ADD COLUMN IF NOT EXISTS preferred_ethnicity_id integer;

ALTER TABLE preferences
ADD CONSTRAINT fk_preferred_ethnicity
FOREIGN KEY (preferred_ethnicity_id) REFERENCES ethnicity_type(ethnicity_type_id)
NOT VALID;