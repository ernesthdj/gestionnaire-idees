CREATE TABLE `widget_requests` (
	`block_id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`produces_result` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `canvas_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
