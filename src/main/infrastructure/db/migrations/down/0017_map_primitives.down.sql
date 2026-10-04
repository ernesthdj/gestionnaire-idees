-- Annulation de 0017_map_primitives.sql (spec 007).
DROP INDEX IF EXISTS `canvas_blocks_frame_idx`;
DROP INDEX IF EXISTS `canvas_blocks_parent_idx`;
ALTER TABLE `canvas_blocks` DROP COLUMN `origin`;
ALTER TABLE `canvas_blocks` DROP COLUMN `frame_id`;
ALTER TABLE `canvas_blocks` DROP COLUMN `parent_block_id`;
ALTER TABLE `canvas_blocks` DROP COLUMN `title`;
ALTER TABLE `change_log` DROP COLUMN `actor`;
DROP TABLE IF EXISTS `map_links`;
