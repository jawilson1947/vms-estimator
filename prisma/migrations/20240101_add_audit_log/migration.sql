-- Migration: Add audit_log table
CREATE TABLE IF NOT EXISTS `audit_log` (
  `audit_id`    INT          NOT NULL AUTO_INCREMENT,
  `user_id`     INT          NULL,
  `user_email`  VARCHAR(255) NULL,
  `action`      VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100) NULL,
  `entity_id`   INT          NULL,
  `detail`      TEXT         NULL,
  `ip_address`  VARCHAR(45)  NULL,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`audit_id`),
  CONSTRAINT `audit_log_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `audit_log_user_id_idx`    (`user_id`),
  INDEX `audit_log_created_at_idx` (`created_at`),
  INDEX `audit_log_entity_idx`     (`entity_type`, `entity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
