-- Migration: Replace camera subsystem
-- Safe for MySQL 5.7+

SET FOREIGN_KEY_CHECKS = 0;

-- ─── Drop old tables ──────────────────────────────────────────────────────────

DROP TABLE IF EXISTS `maintenance_records`;
DROP TABLE IF EXISTS `cameras`;

-- ─── Remove camera_id from camera_location_images ─────────────────────────────
-- (column existed in old schema; drop it unconditionally)

ALTER TABLE `camera_location_images`
  DROP COLUMN `camera_id`;

-- ─── Drop and recreate camera_models with new schema ──────────────────────────

DROP TABLE IF EXISTS `camera_models`;

CREATE TABLE `camera_models` (
  `model_id`             INT            NOT NULL AUTO_INCREMENT,
  `manufacturer`         VARCHAR(55)    NULL,
  `model`                VARCHAR(55)    NULL,
  `camera_type`          ENUM('Dome','Fisheye','Turret','Other') NULL,
  `ptz`                  BOOLEAN        NOT NULL DEFAULT false,
  `pan_degrees`          INT            NULL,
  `zoom_x`               VARCHAR(20)    NULL,
  `audio`                BOOLEAN        NOT NULL DEFAULT false,
  `motion_detection`     BOOLEAN        NOT NULL DEFAULT false,
  `resolution`           VARCHAR(22)    NULL,
  `megapixels`           DECIMAL(6,2)   NULL,
  `cost`                 DECIMAL(10,2)  NULL,
  `lens_count`           INT            NULL,
  `motorized_lens`       BOOLEAN        NOT NULL DEFAULT false,
  `indoor_outdoor`       ENUM('Indoor','Outdoor','Both') NULL,
  `image_url`            VARCHAR(500)   NULL,
  `night_vision`         BOOLEAN        NOT NULL DEFAULT false,
  `microphone`           BOOLEAN        NOT NULL DEFAULT false,
  `range_ft`             INT            NULL,
  `resolution_class`     VARCHAR(10)    NULL,
  `vandal_proof`         BOOLEAN        NOT NULL DEFAULT false,
  `url`                  VARCHAR(255)   NULL,
  `ssd`                  BOOLEAN        NOT NULL DEFAULT false,
  `fps`                  INT            NULL,
  `human_vehicle_detect` BOOLEAN        NOT NULL DEFAULT false,
  `mount`                VARCHAR(100)   NULL,
  PRIMARY KEY (`model_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Add camera_model_id to camera_locations ──────────────────────────────────

ALTER TABLE `camera_locations`
  ADD COLUMN `camera_model_id` INT NULL AFTER `building_id`;

ALTER TABLE `camera_locations`
  ADD CONSTRAINT `camera_locations_camera_model_id_fkey`
  FOREIGN KEY (`camera_model_id`) REFERENCES `camera_models`(`model_id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
