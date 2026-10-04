-- Annulation de 0020_project_elements.sql (spec 009).
DROP INDEX IF EXISTS `neurons_genesis_idx`;
DROP INDEX IF EXISTS `neurons_element_key_idx`;
ALTER TABLE `neurons` DROP COLUMN `collapsed`;
ALTER TABLE `neurons` DROP COLUMN `paths_json`;
ALTER TABLE `neurons` DROP COLUMN `element_status`;
ALTER TABLE `neurons` DROP COLUMN `element_key`;
ALTER TABLE `neurons` DROP COLUMN `element_type`;
ALTER TABLE `neurons` DROP COLUMN `genesis_id`;
ALTER TABLE `map_links` DROP COLUMN `relation`;
