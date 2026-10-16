PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assembly_sketches` (
	`node_id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`task_id` text NOT NULL,
	`task` text,
	`agents` text DEFAULT '[]' NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_assembly_sketches`("node_id", "genesis_id", "task_id", "task", "agents", "links", "updated_at") SELECT "node_id", "genesis_id", "task_id", "task", "agents", "links", "updated_at" FROM `assembly_sketches`;--> statement-breakpoint
DROP TABLE `assembly_sketches`;--> statement-breakpoint
ALTER TABLE `__new_assembly_sketches` RENAME TO `assembly_sketches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `assembly_sketches_genesis_idx` ON `assembly_sketches` (`genesis_id`);