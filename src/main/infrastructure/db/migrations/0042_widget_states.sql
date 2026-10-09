CREATE TABLE `widget_states` (
	`block_id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `canvas_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
