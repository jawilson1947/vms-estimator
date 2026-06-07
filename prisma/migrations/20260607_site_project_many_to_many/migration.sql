-- Migration: Site ↔ Project many-to-many
-- Replaces sites.project_id FK with a join table _SiteProjects.
-- Existing assignments are preserved.

SET FOREIGN_KEY_CHECKS = 0;

-- ─── Create join table (Prisma implicit m2m convention) ───────────────────────
-- Relation name: SiteProjects
-- A = project_id (Project comes before Site alphabetically)
-- B = site_id

CREATE TABLE IF NOT EXISTS `_SiteProjects` (
  `A` int NOT NULL,
  `B` int NOT NULL,
  UNIQUE KEY `_SiteProjects_AB_unique` (`A`, `B`),
  KEY `_SiteProjects_B_index` (`B`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Seed from existing site → project assignments ────────────────────────────

INSERT IGNORE INTO `_SiteProjects` (`A`, `B`)
SELECT `project_id`, `site_id`
FROM   `sites`
WHERE  `project_id` IS NOT NULL;

-- ─── Add foreign key constraints ──────────────────────────────────────────────

ALTER TABLE `_SiteProjects`
  ADD CONSTRAINT `_SiteProjects_A_fkey`
    FOREIGN KEY (`A`) REFERENCES `projects` (`project_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `_SiteProjects_B_fkey`
    FOREIGN KEY (`B`) REFERENCES `sites` (`site_id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Drop old project_id column from sites ────────────────────────────────────

ALTER TABLE `sites`
  DROP COLUMN `project_id`;

SET FOREIGN_KEY_CHECKS = 1;
