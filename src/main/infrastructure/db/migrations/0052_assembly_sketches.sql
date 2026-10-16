CREATE TABLE `assembly_sketches` (
	`node_id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`task_id` text NOT NULL,
	`task` text,
	`agents` text DEFAULT '[]' NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assembly_sketches_genesis_idx` ON `assembly_sketches` (`genesis_id`);