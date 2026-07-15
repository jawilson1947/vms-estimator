-- Add 'General' to the projects.project_type enum
ALTER TABLE `projects`
    MODIFY `project_type` ENUM('Video Surveillance', 'Access Control', 'General') NOT NULL DEFAULT 'Video Surveillance';

-- Catalog of general-purpose items (GENERAL project type)
CREATE TABLE `general_items` (
    `general_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(255) NULL,
    `cost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `default_qty` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `general_items_name_key`(`name`),
    PRIMARY KEY (`general_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Items assigned to a survey location, with per-assignment quantity
CREATE TABLE `location_general_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `location_id` INTEGER NOT NULL,
    `general_item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `notes` TEXT NULL,

    UNIQUE INDEX `location_general_items_location_id_general_item_id_key`(`location_id`, `general_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `location_general_items`
    ADD CONSTRAINT `location_general_items_location_id_fkey`
    FOREIGN KEY (`location_id`) REFERENCES `camera_locations`(`location_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `location_general_items`
    ADD CONSTRAINT `location_general_items_general_item_id_fkey`
    FOREIGN KEY (`general_item_id`) REFERENCES `general_items`(`general_item_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Override key on project cost rows (mirrors access_method_id / artifact_type_id)
ALTER TABLE `project_costs`
    ADD COLUMN `general_item_id` INTEGER NULL AFTER `access_method_id`;

ALTER TABLE `project_costs`
    ADD CONSTRAINT `project_costs_general_item_id_fkey`
    FOREIGN KEY (`general_item_id`) REFERENCES `general_items`(`general_item_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the cost category used by General item override rows
INSERT INTO `line_item_categories` (`name`, `sort_order`, `active`)
SELECT 'General Equipment', COALESCE(MAX(`sort_order`), 0) + 1, true
FROM `line_item_categories`
WHERE NOT EXISTS (SELECT 1 FROM `line_item_categories` c WHERE c.`name` = 'General Equipment');
