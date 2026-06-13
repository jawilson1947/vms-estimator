-- BOM cost rows are keyed by (project, access method, artifact type) so that
-- e.g. Internal Single Door and External Single Door strikes price separately.
ALTER TABLE `project_costs` ADD COLUMN `access_method_id` INTEGER NULL;

ALTER TABLE `project_costs`
  ADD CONSTRAINT `project_costs_access_method_id_fkey`
  FOREIGN KEY (`access_method_id`) REFERENCES `access_methods`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
