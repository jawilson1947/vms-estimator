-- CreateTable
CREATE TABLE `invoices` (
    `invoice_id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `invoice_number` VARCHAR(60) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `detail` VARCHAR(20) NOT NULL DEFAULT 'line-items',
    `payment_basis` VARCHAR(30) NOT NULL DEFAULT 'direct-total',
    `amount_due` DECIMAL(12, 2) NOT NULL,
    `snapshot` JSON NOT NULL,
    `bill_to` JSON NULL,
    `ship_to` JSON NULL,
    `po_number` VARCHAR(60) NULL,
    `salesperson` VARCHAR(60) NULL,
    `terms` VARCHAR(60) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `issued_at` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `invoices_project_id_idx`(`project_id`),
    PRIMARY KEY (`invoice_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;
