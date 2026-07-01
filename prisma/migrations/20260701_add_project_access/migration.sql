-- Add PROJECT_VIEWER to the users.role enum
ALTER TABLE `users`
    MODIFY `role` ENUM('Administrator', 'Project Manager', 'Technician', 'Viewer', 'Project Viewer') NULL DEFAULT 'Viewer';

-- CreateTable
CREATE TABLE `project_access` (
    `access_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `project_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `project_access_user_id_project_id_key`(`user_id`, `project_id`),
    INDEX `project_access_project_id_idx`(`project_id`),
    PRIMARY KEY (`access_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project_access` ADD CONSTRAINT `project_access_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_access` ADD CONSTRAINT `project_access_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;
