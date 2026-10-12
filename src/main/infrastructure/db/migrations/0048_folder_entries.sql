CREATE TABLE `folder_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`neuron_id` text NOT NULL,
	`path` text NOT NULL,
	`path_key` text NOT NULL,
	`source` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`added_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`neuron_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folder_entries_path_idx` ON `folder_entries` (`neuron_id`,`path_key`);--> statement-breakpoint
CREATE INDEX `folder_entries_neuron_idx` ON `folder_entries` (`neuron_id`);