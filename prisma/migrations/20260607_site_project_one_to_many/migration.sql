-- Migration: replace _SiteProjects many-to-many with site_id FK on projects
-- A project belongs to exactly one site (nullable); a site can have many projects.

-- 1. Add site_id column to projects
ALTER TABLE projects
  ADD COLUMN site_id INT NULL;

-- 2. Migrate existing data: for each project that had sites in _SiteProjects,
--    pick the site with the lowest site_id (B column = site_id).
UPDATE projects p
  JOIN (
    SELECT A AS project_id, MIN(B) AS site_id
    FROM _SiteProjects
    GROUP BY A
  ) sp ON sp.project_id = p.project_id
SET p.site_id = sp.site_id;

-- 3. Add foreign key constraint
ALTER TABLE projects
  ADD CONSTRAINT fk_projects_site
  FOREIGN KEY (site_id) REFERENCES sites (site_id)
  ON DELETE SET NULL;

-- 4. Drop the join table
DROP TABLE IF EXISTS _SiteProjects;
