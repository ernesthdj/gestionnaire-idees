CREATE TABLE `map_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_kind` text NOT NULL,
	`from_id` text NOT NULL,
	`to_kind` text NOT NULL,
	`to_id` text NOT NULL,
	`label` text,
	`origin` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `map_links_from_idx` ON `map_links` (`from_kind`,`from_id`);--> statement-breakpoint
CREATE INDEX `map_links_to_idx` ON `map_links` (`to_kind`,`to_id`);--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `title` text;--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `parent_block_id` text REFERENCES canvas_blocks(id);--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `frame_id` text REFERENCES canvas_blocks(id);--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `origin` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX `canvas_blocks_parent_idx` ON `canvas_blocks` (`parent_block_id`);--> statement-breakpoint
CREATE INDEX `canvas_blocks_frame_idx` ON `canvas_blocks` (`frame_id`);--> statement-breakpoint
ALTER TABLE `change_log` ADD `actor` text DEFAULT 'user' NOT NULL;