-- Move document uploads from sites to projects.
-- 1) New project_documents table
-- 2) Migrate site documents where the site maps to exactly one project
-- 3) Remove migrated rows from site_documents (leftovers = manual handling)

-- 1. New table
CREATE TABLE project_documents (
  document_id        INT AUTO_INCREMENT PRIMARY KEY,
  project_id         INT NOT NULL,
  file_name          VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NULL,
  file_path          VARCHAR(500) NOT NULL,
  file_url           VARCHAR(500) NULL,
  mime_type          VARCHAR(100) NULL,
  file_size_bytes    BIGINT NULL,
  uploaded_by        VARCHAR(100) NULL,
  uploaded_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_project_documents_project (project_id),
  CONSTRAINT fk_project_documents_project
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- 2. Migrate documents from sites linked to EXACTLY ONE project (via buildings)
INSERT INTO project_documents
  (project_id, file_name, original_file_name, file_path, file_url,
   mime_type, file_size_bytes, uploaded_by, uploaded_at)
SELECT one.project_id, sd.file_name, sd.original_file_name, sd.file_path,
       sd.file_url, sd.mime_type, sd.file_size_bytes, sd.uploaded_by, sd.uploaded_at
FROM site_documents sd
JOIN (
  SELECT b.site_id, MIN(p.project_id) AS project_id
  FROM projects p
  JOIN buildings b ON b.building_id = p.building_id
  GROUP BY b.site_id
  HAVING COUNT(DISTINCT p.project_id) = 1
) one ON one.site_id = sd.site_id;

-- 3. Remove the migrated rows from the old table
DELETE sd FROM site_documents sd
JOIN (
  SELECT b.site_id
  FROM projects p
  JOIN buildings b ON b.building_id = p.building_id
  GROUP BY b.site_id
  HAVING COUNT(DISTINCT p.project_id) = 1
) one ON one.site_id = sd.site_id;

-- After running, list any leftover documents needing manual handling:
--   SELECT sd.document_id, s.site_name, sd.original_file_name, sd.file_url
--   FROM site_documents sd JOIN sites s ON s.site_id = sd.site_id;
