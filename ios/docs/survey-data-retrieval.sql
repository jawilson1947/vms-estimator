-- ============================================================================
-- CSMSSurvey — data-retrieval queries the iOS app issues, as raw MySQL.
-- Run directly in MySQL Workbench against the application database.
--
-- These mirror the Next.js Prisma reads:
--   §A  GET /api/auth/session         — login/session restore on launch
--   §B  GET /api/survey/sites-list    — the SiteListView tree (cold-launch load)
--   §C  GET /api/survey/[projectId]   — the SurveyBoardView load (one survey)
--
-- Table / column names are the Prisma @@map / @map targets, not the model names.
-- NOTE: the image_type enum is STORED as its mapped string 'Site Survey'
--       (Prisma model uses SITE_SURVEY, but the DB column holds 'Site Survey').
-- ============================================================================

-- Set the project you want to inspect (used by §C). Change as needed.
SET @project_id = 1;


-- ============================================================================
-- §A — Session / auth (what /api/auth/session validates against)
-- Look up the user behind a session by email.
-- ============================================================================
-- SELECT user_id, username, email, first_name, last_name, role, is_active, last_login
-- FROM users
-- WHERE email = 'jwilson@digitalsupportsystems.com';


-- ============================================================================
-- §B — SiteListView tree  (GET /api/survey/sites-list)
-- The app receives a nested Site -> Building -> Project tree. Flattened here
-- one row per project (sites/buildings with no children still appear via LEFT JOIN).
-- ============================================================================
SELECT
    s.site_id,
    s.site_name,
    b.building_id,
    b.building_name,
    p.project_id,
    p.project_name,
    p.project_status,
    p.project_type            -- 'Video Surveillance' | 'Access Control'
FROM sites s
LEFT JOIN buildings b ON b.site_id     = s.site_id
LEFT JOIN projects  p ON p.building_id = b.building_id
ORDER BY s.site_name, b.building_name, p.project_name;


-- ============================================================================
-- §C — Survey load  (GET /api/survey/[projectId])
-- One project = one (abstract) survey = its camera_locations. Four reads,
-- matching the route's Prisma include + the floor-plans raw query.
-- ============================================================================

-- C1. Project header + building + site
SELECT
    p.project_id,
    p.project_name,
    p.project_type,
    b.building_id,
    b.building_name,
    st.site_id,
    st.site_name
FROM projects p
LEFT JOIN buildings b ON b.building_id = p.building_id
LEFT JOIN sites     st ON st.site_id   = b.site_id
WHERE p.project_id = @project_id;

-- C2. The location records (the survey rows), with camera model + access method
SELECT
    cl.location_id,
    cl.project_id,
    cl.area_name,
    cl.floor,
    cl.survey_notes,
    cl.notes,
    cl.mounting_location,
    cl.coverage_purpose,
    cl.surveyed_at,
    cl.camera_model_id,
    cm.manufacturer,
    cm.model,
    cm.camera_type,
    cm.resolution,
    cm.resolution_class,
    cm.image_url,
    cm.ptz,
    cm.indoor_outdoor,
    cl.access_method_id,
    am.name AS access_method_name
FROM camera_locations cl
LEFT JOIN camera_models  cm ON cm.model_id = cl.camera_model_id
LEFT JOIN access_methods am ON am.id       = cl.access_method_id
WHERE cl.project_id = @project_id
ORDER BY cl.area_name;

-- C3. Site-survey photos for those locations
SELECT
    img.image_id,
    img.location_id,
    img.file_url,
    img.description,
    img.uploaded_at
FROM camera_location_images img
JOIN camera_locations cl ON cl.location_id = img.location_id
WHERE cl.project_id = @project_id
  AND img.image_type = 'Site Survey'      -- stored mapped string, not SITE_SURVEY
ORDER BY img.uploaded_at DESC;

-- C4. Floor plans for the project's building
SELECT
    fp.plan_id,
    fp.building_id,
    fp.floor,
    fp.original_file_name,
    fp.file_url
FROM building_floor_plans fp
JOIN projects p ON p.building_id = fp.building_id
WHERE p.project_id = @project_id
ORDER BY fp.floor;


-- ============================================================================
-- Bonus — survey progress (matches the web landing page's done/total %)
-- ============================================================================
SELECT
    COUNT(*)                                          AS total_locations,
    SUM(CASE WHEN surveyed_at IS NOT NULL THEN 1 ELSE 0 END) AS surveyed,
    ROUND(100 * SUM(CASE WHEN surveyed_at IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) AS pct_done
FROM camera_locations
WHERE project_id = @project_id;
