-- ============================================================================
-- CSMSSurvey — SQL executed on FIRST LOAD when the user is already logged in.
-- Run directly in MySQL Workbench.
--
-- Launch path (CSMSSurveyApp root .task + SiteListView):
--   1. GET /api/auth/session      -> NO SQL. NextAuth uses session.strategy:'jwt'
--                                    (lib/auth.ts), so the session is restored by
--                                    decoding the cookie. The DB is NOT touched.
--                                    (last_login is written only at actual login.)
--   2. GET /api/access-methods    -> §1 below  (AccessMethodCatalog.refresh)
--   3. GET /api/survey/sites-list -> §2 below  (SiteListView.task)
--
-- Prisma runs each `include` as separate IN(...) queries; the JOIN forms here
-- return the same data in one result set for convenient inspection.
-- ============================================================================


-- ============================================================================
-- §1 — GET /api/access-methods
-- prisma.accessMethod.findMany({ where:{active:true},
--   include:{ items:{ include:{ artifactType:{select:{id,name}} },
--     orderBy:{ artifactType:{ sortOrder:'asc' } } } },
--   orderBy:[{sortOrder:'asc'},{name:'asc'}] })
-- ============================================================================

-- 1a. The access methods (parent rows)
SELECT
    am.id,
    am.name,
    am.grouping,
    am.sort_order,
    am.active
FROM access_methods am
WHERE am.active = 1
ORDER BY am.sort_order, am.name;

-- 1b. Their default BOM items + artifact type (the `include`)
SELECT
    ami.id            AS item_id,
    ami.access_method_id,
    ami.quantity,
    ami.notes,
    at.id             AS artifact_type_id,
    at.name           AS artifact_type_name
FROM access_method_items ami
JOIN access_methods am ON am.id = ami.access_method_id AND am.active = 1
JOIN artifact_types at ON at.id = ami.artifact_type_id
ORDER BY ami.access_method_id, at.sort_order;


-- ============================================================================
-- §2 — GET /api/survey/sites-list
-- prisma.site.findMany({ orderBy:{siteName:'asc'},
--   select:{ id, siteName,
--     buildings:{ orderBy:{buildingName:'asc'},
--       select:{ id, buildingName,
--         projects:{ orderBy:{projectName:'asc'},
--           select:{ id, projectName, projectType } } } } } })
--
-- The app builds a nested Site -> Building -> Project tree. Flattened to one
-- row per project; sites/buildings with no children still appear (LEFT JOIN).
-- ============================================================================
SELECT
    s.site_id,
    s.site_name,
    b.building_id,
    b.building_name,
    p.project_id,
    p.project_name,
    p.project_type            -- 'Video Surveillance' | 'Access Control'
FROM sites s
LEFT JOIN buildings b ON b.site_id     = s.site_id
LEFT JOIN projects  p ON p.building_id = b.building_id
ORDER BY s.site_name, b.building_name, p.project_name;
