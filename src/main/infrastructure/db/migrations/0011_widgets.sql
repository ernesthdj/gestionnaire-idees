CREATE TABLE `widget_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`version_id` text,
	`failed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `canvas_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `widget_messages_block_idx` ON `widget_messages` (`block_id`);--> statement-breakpoint
CREATE TABLE `widget_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`html` text NOT NULL,
	`css` text NOT NULL,
	`ts` text NOT NULL,
	`js` text NOT NULL,
	`summary` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `canvas_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `widget_versions_block_idx` ON `widget_versions` (`block_id`);--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `kind` text DEFAULT 'empty' NOT NULL;--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `text` text;--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `current_version_id` text;--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `deleted_at` text;