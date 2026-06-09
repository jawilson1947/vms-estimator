-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Link CameraLocation → Project (instead of Building)
--            Drop siteId from Project
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Add project_id column to camera_locations (nullable)
ALTER TABLE camera_locations
  ADD COLUMN project_id INT NULL AFTER location_id,
  ADD CONSTRAINT fk_camera_loc_project
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL;

-- Step 2: Data migration
--   For each camera_location, find the project whose building_id matches
--   the location's building_id. Where a building has multiple projects,
--   assign the lowest (oldest) project_id.
UPDATE camera_locations cl
JOIN (
  SELECT p.building_id, MIN(p.project_id) AS project_id
  FROM   projects p
  WHERE  p.building_id IS NOT NULL
  GROUP  BY p.building_id
) best ON best.building_id = cl.building_id
SET cl.project_id = best.project_id;

-- Step 3: Drop building_id FK and column from camera_locations
--   Prisma names the FK: camera_locations_building_id_fkey
ALTER TABLE camera_locations
  DROP FOREIGN KEY camera_locations_building_id_fkey;
ALTER TABLE camera_locations
  DROP COLUMN building_id;

-- Step 4: Drop site_id FK and column from projects
--   Prisma names the FK: projects_site_id_fkey
ALTER TABLE projects
  DROP FOREIGN KEY projects_site_id_fkey;
ALTER TABLE projects
  DROP COLUMN site_id;
