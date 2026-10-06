CREATE TABLE `deliverable_files` (
	`id` text PRIMARY KEY NOT NULL,
	`neuron_id` text NOT NULL,
	`path` text NOT NULL,
	`path_key` text NOT NULL,
	`before_content` text,
	`after_content` text NOT NULL,
	`after_hash` text NOT NULL,
	`updated_at` text NOT NULL,
	`reverted_at` text,
	FOREIGN KEY (`neuron_id`) REFERENCES `final_actions`(`neuron_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deliverable_files_path_idx` ON `deliverable_files` (`neuron_id`,`path_key`);--> statement-breakpoint
CREATE TABLE `execution_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`execution_id` text NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`path` text,
	`detail` text,
	FOREIGN KEY (`execution_id`) REFERENCES `executions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `execution_events_execution_idx` ON `execution_events` (`execution_id`);--> statement-breakpoint
CREATE TABLE `executions` (
	`id` text PRIMARY KEY NOT NULL,
	`neuron_id` text NOT NULL,
	`genesis_id` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`outcome` text,
	`correction` text,
	`files_written` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`neuron_id`) REFERENCES `final_actions`(`neuron_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `executions_neuron_idx` ON `executions` (`neuron_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `executions_open_genesis_idx` ON `executions` (`genesis_id`) WHERE ended_at IS NULL;--> statement-breakpoint
CREATE TABLE `final_actions` (
	`neuron_id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`deliverable` text NOT NULL,
	`reason` text NOT NULL,
	`state` text NOT NULL,
	`origin` text NOT NULL,
	`proposed_at` text NOT NULL,
	`accepted_at` text,
	`archived_at` text,
	`offset_x` real DEFAULT 0 NOT NULL,
	`offset_y` real DEFAULT 0 NOT NULL,
	`width` real DEFAULT 420 NOT NULL,
	`height` real DEFAULT 300 NOT NULL,
	FOREIGN KEY (`neuron_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `final_actions_genesis_idx` ON `final_actions` (`genesis_id`);