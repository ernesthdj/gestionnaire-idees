-- Annulation de 0015_widget_results.sql.
DELETE FROM `canvas_blocks` WHERE `kind` = 'result';--> statement-breakpoint
ALTER TABLE `canvas_blocks` DROP COLUMN `source_block_id`;--> statement-breakpoint
DROP TABLE IF EXISTS `widget_results`;
