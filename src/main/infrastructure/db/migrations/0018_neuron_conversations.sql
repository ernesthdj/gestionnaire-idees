CREATE TABLE `neuron_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`neuron_id` text NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`neuron_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `neuron_messages_neuron_idx` ON `neuron_messages` (`neuron_id`);--> statement-breakpoint
ALTER TABLE `neurons` ADD `session_id` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `session_started` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `neurons` ADD `sheet_json` text;--> statement-breakpoint
CREATE UNIQUE INDEX `neurons_session_id_unique` ON `neurons` (`session_id`);