CREATE TABLE `permission_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`neuron_id` text NOT NULL,
	`tool` text NOT NULL,
	`decision` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `permission_log_neuron_idx` ON `permission_log` (`neuron_id`);--> statement-breakpoint
CREATE TABLE `permission_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_key` text NOT NULL,
	`tool` text NOT NULL,
	`pattern` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `permission_rules_project_idx` ON `permission_rules` (`project_key`);--> statement-breakpoint
CREATE TABLE `trusted_projects` (
	`project_key` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `final_actions` ADD `committed_hash` text;--> statement-breakpoint
ALTER TABLE `final_actions` ADD `committed_at` text;--> statement-breakpoint
ALTER TABLE `neuron_messages` ADD `tool_use_id` text;--> statement-breakpoint
ALTER TABLE `neuron_messages` ADD `tool_status` text;--> statement-breakpoint
ALTER TABLE `neuron_messages` ADD `tool_reason` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `chat_permission_mode` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `chat_extra_dirs_json` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `chat_bypass_confirmed_at` text;