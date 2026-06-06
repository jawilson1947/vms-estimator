-- CreateTable: line_item_categories
CREATE TABLE `line_item_categories` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(191) NOT NULL,
    `sort_order` INTEGER      NOT NULL DEFAULT 0,
    `active`     BOOLEAN      NOT NULL DEFAULT true,

    UNIQUE INDEX `line_item_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the 13 default categories (sortOrder 1-13)
INSERT INTO `line_item_categories` (`name`, `sort_order`) VALUES
    ('Camera Equipment',   1),
    ('Network Equipment',  2),
    ('Cabling',            3),
    ('Mounting Hardware',  4),
    ('Licensing',          5),
    ('Labor',              6),
    ('Consulting',         7),
    ('Project Management', 8),
    ('Overhead',           9),
    ('Travel',             10),
    ('Permits',            11),
    ('Contingency',        12),
    ('Other',              13);

-- Add category_id as nullable initially so the backfill can run first
ALTER TABLE `project_costs` ADD COLUMN `category_id` INTEGER NULL;

-- Backfill: the old cost_category enum stores the mapped string values
UPDATE `project_costs` pc
INNER JOIN `line_item_categories` lic ON lic.`name` = pc.`cost_category`
SET pc.`category_id` = lic.`id`;

-- Make category_id NOT NULL now that every row has a value
ALTER TABLE `project_costs` MODIFY COLUMN `category_id` INTEGER NOT NULL;

-- Drop the old enum column
ALTER TABLE `project_costs` DROP COLUMN `cost_category`;

-- AddForeignKey
ALTER TABLE `project_costs` ADD CONSTRAINT `project_costs_category_id_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `line_item_categories`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
