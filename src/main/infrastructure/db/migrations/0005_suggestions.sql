CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`neuron_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`web_query` text,
	`research` text NOT NULL,
	`sources_json` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`accepted_neuron_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`neuron_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `suggestions_root_status_idx` ON `suggestions` (`root_id`,`status`);