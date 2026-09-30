CREATE TABLE `widget_results` (
	`block_id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `canvas_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `source_block_id` text;