CREATE TABLE `widget_settings` (
	`block_id` text PRIMARY KEY NOT NULL,
	`fields_json` text NOT NULL,
	`values_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `canvas_blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
