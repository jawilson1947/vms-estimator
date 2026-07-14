-- Add down_payment to project_fee_summary (shown as a credit on proposals)
ALTER TABLE `project_fee_summary`
    ADD COLUMN `down_payment` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `tax_amount`;
