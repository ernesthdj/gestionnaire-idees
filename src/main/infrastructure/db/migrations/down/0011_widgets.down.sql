-- Annulation de 0011_widgets.sql.
DROP TABLE IF EXISTS `widget_messages`;
DROP TABLE IF EXISTS `widget_versions`;
ALTER TABLE `canvas_blocks` DROP COLUMN `deleted_at`;
ALTER TABLE `canvas_blocks` DROP COLUMN `current_version_id`;
ALTER TABLE `canvas_blocks` DROP COLUMN `text`;
ALTER TABLE `canvas_blocks` DROP COLUMN `kind`;
