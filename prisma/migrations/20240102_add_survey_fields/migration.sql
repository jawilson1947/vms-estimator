-- Add survey fields to camera_locations
ALTER TABLE camera_locations
  ADD COLUMN survey_notes TEXT NULL AFTER area_name,
  ADD COLUMN surveyed_at  DATETIME NULL AFTER survey_notes;
