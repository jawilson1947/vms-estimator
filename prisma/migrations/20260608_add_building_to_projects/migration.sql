ALTER TABLE projects ADD COLUMN building_id INT NULL;
ALTER TABLE projects ADD CONSTRAINT fk_projects_building
  FOREIGN KEY (building_id) REFERENCES buildings (building_id) ON DELETE SET NULL;
