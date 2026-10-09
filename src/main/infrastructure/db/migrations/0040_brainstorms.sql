CREATE TABLE `brainstorms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text,
	`location` text NOT NULL,
	`origin` text NOT NULL,
	`folder_path` text,
	`git_role` text DEFAULT 'none' NOT NULL,
	`work_branch` text,
	`github` integer DEFAULT false NOT NULL,
	`view_state_json` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_opened_at` text,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brainstorms_slug_idx` ON `brainstorms` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `brainstorms_folder_idx` ON `brainstorms` (`folder_path`);--> statement-breakpoint
CREATE TABLE `save_points` (
	`id` text PRIMARY KEY NOT NULL,
	`brainstorm_id` text NOT NULL,
	`name` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`snapshot` blob NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`brainstorm_id`) REFERENCES `brainstorms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `save_points_brainstorm_idx` ON `save_points` (`brainstorm_id`);--> statement-breakpoint
ALTER TABLE `canvas_blocks` ADD `brainstorm_id` text;--> statement-breakpoint
CREATE INDEX `canvas_blocks_brainstorm_idx` ON `canvas_blocks` (`brainstorm_id`);--> statement-breakpoint
ALTER TABLE `neurons` ADD `brainstorm_id` text;--> statement-breakpoint
CREATE INDEX `neurons_brainstorm_idx` ON `neurons` (`brainstorm_id`);