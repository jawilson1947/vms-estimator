-- Migration: link project_costs rows to a specific camera model
-- Allows price changes in camera_models to propagate automatically.

ALTER TABLE project_costs
  ADD COLUMN camera_model_id INT NULL;

ALTER TABLE project_costs
  ADD CONSTRAINT fk_project_costs_camera_model
    FOREIGN KEY (camera_model_id) REFERENCES camera_models (model_id)
    ON DELETE SET NULL;
