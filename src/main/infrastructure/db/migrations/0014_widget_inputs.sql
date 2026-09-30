CREATE TABLE `widget_approvals` (
	`block_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`block_id`, `fingerprint`),
	FOREIGN KEY (`block_id`) REFERENCES `canvas_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `widget_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`parts_json` text DEFAULT '[]' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `canvas_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `widget_inputs_block_idx` ON `widget_inputs` (`block_id`);