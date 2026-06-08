-- Migration: track which survey camera location a project cost row originated from
-- Allows per-location markup to be stored and restored across page loads.

ALTER TABLE project_costs
  ADD COLUMN survey_location_id INT NULL;

ALTER TABLE project_costs
  ADD CONSTRAINT fk_project_costs_survey_location
    FOREIGN KEY (survey_location_id) REFERENCES camera_locations (location_id)
    ON DELETE SET NULL;
