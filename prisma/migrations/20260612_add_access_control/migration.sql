-- Project type (Video Surveillance vs Access Control)
ALTER TABLE `projects` ADD COLUMN `project_type` ENUM('Video Surveillance', 'Access Control') NOT NULL DEFAULT 'Video Surveillance';

-- CreateTable: artifact_types
CREATE TABLE `artifact_types` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(100) NOT NULL,
    `sort_order` INTEGER      NOT NULL DEFAULT 0,
    `active`     BOOLEAN      NOT NULL DEFAULT true,

    UNIQUE INDEX `artifact_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: artifact_models
CREATE TABLE `artifact_models` (
    `artifact_id`      INTEGER       NOT NULL AUTO_INCREMENT,
    `artifact_type_id` INTEGER       NOT NULL,
    `manufacturer`     VARCHAR(100)  NULL,
    `model_name`       VARCHAR(150)  NULL,
    `variant`          VARCHAR(50)   NULL,
    `description`      TEXT          NULL,
    `image_url`        VARCHAR(500)  NULL,
    `cost`             DECIMAL(10,2) NULL,
    `comment`          TEXT          NULL,
    `active`           BOOLEAN       NOT NULL DEFAULT true,

    PRIMARY KEY (`artifact_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `artifact_models` ADD CONSTRAINT `artifact_models_artifact_type_id_fkey`
    FOREIGN KEY (`artifact_type_id`) REFERENCES `artifact_types`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: access_methods
CREATE TABLE `access_methods` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(100) NOT NULL,
    `grouping`   VARCHAR(50)  NULL,
    `sort_order` INTEGER      NOT NULL DEFAULT 0,
    `active`     BOOLEAN      NOT NULL DEFAULT true,

    UNIQUE INDEX `access_methods_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: access_method_items
CREATE TABLE `access_method_items` (
    `id`               INTEGER NOT NULL AUTO_INCREMENT,
    `access_method_id` INTEGER NOT NULL,
    `artifact_type_id` INTEGER NOT NULL,
    `quantity`         INTEGER NOT NULL DEFAULT 1,
    `notes`            TEXT    NULL,

    UNIQUE INDEX `access_method_items_access_method_id_artifact_type_id_key`(`access_method_id`, `artifact_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `access_method_items` ADD CONSTRAINT `access_method_items_access_method_id_fkey`
    FOREIGN KEY (`access_method_id`) REFERENCES `access_methods`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `access_method_items` ADD CONSTRAINT `access_method_items_artifact_type_id_fkey`
    FOREIGN KEY (`artifact_type_id`) REFERENCES `artifact_types`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Survey locations can record an access method (access-control projects)
ALTER TABLE `camera_locations` ADD COLUMN `access_method_id` INTEGER NULL;

ALTER TABLE `camera_locations` ADD CONSTRAINT `camera_locations_access_method_id_fkey`
    FOREIGN KEY (`access_method_id`) REFERENCES `access_methods`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Project costs can reference an artifact type (AC BOM row) and a picked artifact model
ALTER TABLE `project_costs` ADD COLUMN `artifact_type_id` INTEGER NULL;
ALTER TABLE `project_costs` ADD COLUMN `artifact_model_id` INTEGER NULL;

ALTER TABLE `project_costs` ADD CONSTRAINT `project_costs_artifact_type_id_fkey`
    FOREIGN KEY (`artifact_type_id`) REFERENCES `artifact_types`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `project_costs` ADD CONSTRAINT `project_costs_artifact_model_id_fkey`
    FOREIGN KEY (`artifact_model_id`) REFERENCES `artifact_models`(`artifact_id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: 18 artifact types from the Access Control Estimator mind map
INSERT INTO `artifact_types` (`name`, `sort_order`) VALUES
    ('Reader Controller',      1),
    ('Solid State Relay',      2),
    ('Single Maglock',         3),
    ('Double Maglock',         4),
    ('REX Device',             5),
    ('PIR Motion Sensor',      6),
    ('Pigtail',                7),
    ('Cable - AWG 12/2',       8),
    ('Cable - AWG 14/2',       9),
    ('Cable - AWG 18/4',       10),
    ('Cat6 UTP Network Cable', 11),
    ('Cat5e UTP Network Cable',12),
    ('XLR',                    13),
    ('Electric Strike',        14),
    ('Power Supply',           15),
    ('Credential',             16),
    ('Storeroom Lock',         17),
    ('Door Closer',            18);

-- Seed: 9 access methods
INSERT INTO `access_methods` (`name`, `grouping`, `sort_order`) VALUES
    ('Internal Single Door', 'Internal', 1),
    ('Internal Double Door', 'Internal', 2),
    ('External Single Door', 'External', 3),
    ('External Double Door', 'External', 4),
    ('Sliding Door',         'Other',    5),
    ('Automatic Door',       'Other',    6),
    ('Elevator',             'Other',    7),
    ('Gate',                 'Other',    8),
    ('Rim Panic Bar',        'Other',    9);

-- Seed: default BOM items per access method
-- Single doors (internal + external): Reader Controller, Electric Strike, Pigtail, Door Closer, Storeroom Lock
INSERT INTO `access_method_items` (`access_method_id`, `artifact_type_id`, `quantity`, `notes`)
SELECT am.`id`, at.`id`, 1, NULL
FROM `access_methods` am
JOIN `artifact_types` at ON at.`name` IN ('Reader Controller', 'Electric Strike', 'Pigtail', 'Door Closer', 'Storeroom Lock')
WHERE am.`name` IN ('Internal Single Door', 'External Single Door');

-- Double doors (internal + external)
INSERT INTO `access_method_items` (`access_method_id`, `artifact_type_id`, `quantity`, `notes`)
SELECT am.`id`, at.`id`,
       CASE WHEN at.`name` = 'Door Closer' THEN 2 ELSE 1 END,
       CASE WHEN at.`name` = 'Double Maglock'
            THEN 'Or 2 single maglocks - one leaf may be energized with a single strike, other leaf permanently secured'
            ELSE NULL END
FROM `access_methods` am
JOIN `artifact_types` at ON at.`name` IN ('Reader Controller', 'Pigtail', 'REX Device', 'PIR Motion Sensor', 'Double Maglock', 'Solid State Relay', 'Door Closer')
WHERE am.`name` IN ('Internal Double Door', 'External Double Door');

-- Other methods: Reader Controller, Pigtail, Solid State Relay
INSERT INTO `access_method_items` (`access_method_id`, `artifact_type_id`, `quantity`, `notes`)
SELECT am.`id`, at.`id`, 1, NULL
FROM `access_methods` am
JOIN `artifact_types` at ON at.`name` IN ('Reader Controller', 'Pigtail', 'Solid State Relay')
WHERE am.`name` IN ('Sliding Door', 'Automatic Door', 'Elevator', 'Gate', 'Rim Panic Bar');

-- Seed: Access Control Equipment line item category (idempotent)
INSERT INTO `line_item_categories` (`name`, `sort_order`)
SELECT 'Access Control Equipment', 14
WHERE NOT EXISTS (SELECT 1 FROM `line_item_categories` WHERE `name` = 'Access Control Equipment');
