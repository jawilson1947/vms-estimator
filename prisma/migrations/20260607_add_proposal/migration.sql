-- CreateTable
CREATE TABLE `proposals` (
    `proposal_id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` JSON NOT NULL,
    `tone` VARCHAR(50) NOT NULL DEFAULT 'professional',
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `valid_until` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `proposals_project_id_idx`(`project_id`),
    PRIMARY KEY (`proposal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;
