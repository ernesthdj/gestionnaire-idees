CREATE TABLE `idea_steps` (
	`root_id` text PRIMARY KEY NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	FOREIGN KEY (`root_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE cascade
);
