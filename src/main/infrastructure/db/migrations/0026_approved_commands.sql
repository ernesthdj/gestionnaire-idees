CREATE TABLE `approved_commands` (
	`genesis_id` text NOT NULL,
	`script` text NOT NULL,
	`script_text` text NOT NULL,
	`approved_at` text NOT NULL,
	PRIMARY KEY(`genesis_id`, `script`),
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `command_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`execution_id` text NOT NULL,
	`script` text NOT NULL,
	`exit_code` integer,
	`timed_out` integer DEFAULT false NOT NULL,
	`duration_ms` integer NOT NULL,
	`output` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `executions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `command_runs_execution_idx` ON `command_runs` (`execution_id`);