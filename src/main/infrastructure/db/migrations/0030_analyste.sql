CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`window_from` integer NOT NULL,
	`window_to` integer NOT NULL,
	`events` integer DEFAULT 0 NOT NULL,
	`proposals` integer DEFAULT 0 NOT NULL,
	`ai_call_id` text,
	`error_code` text,
	`started_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `analyses_started_at_idx` ON `analyses` (`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `analyses_one_running_idx` ON `analyses` (`status`) WHERE status = 'running';--> statement-breakpoint
CREATE TABLE `analyst_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`branch` text NOT NULL,
	`worktree_path` text NOT NULL,
	`base_sha` text NOT NULL,
	`head_sha` text,
	`merge_sha` text,
	`revert_sha` text,
	`status` text NOT NULL,
	`checks` text NOT NULL,
	`deps_changed` integer DEFAULT false NOT NULL,
	`conversation_neuron_id` text,
	`discard_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analyst_updates_proposal_idx` ON `analyst_updates` (`proposal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `analyst_updates_branch_idx` ON `analyst_updates` (`branch`);--> statement-breakpoint
CREATE INDEX `analyst_updates_status_idx` ON `analyst_updates` (`status`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`family` text NOT NULL,
	`event` text NOT NULL,
	`screen` text,
	`subject_kind` text,
	`subject_ref` text,
	`via` text,
	`channel` text,
	`code` text,
	`module` text,
	`frames` text,
	`duration_ms` integer,
	`status` text,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observations_at_idx` ON `observations` (`at`);--> statement-breakpoint
CREATE INDEX `observations_family_at_idx` ON `observations` (`family`,`at`);--> statement-breakpoint
CREATE INDEX `observations_event_at_idx` ON `observations` (`event`,`at`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`finding` text NOT NULL,
	`proposal` text NOT NULL,
	`gain` text NOT NULL,
	`risk` text NOT NULL,
	`severity` integer NOT NULL,
	`confidence` real NOT NULL,
	`evidence` text NOT NULL,
	`files` text NOT NULL,
	`without_evidence` integer DEFAULT false NOT NULL,
	`dedupe_key` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`refusal_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `proposals_status_created_idx` ON `proposals` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `proposals_dedupe_idx` ON `proposals` (`dedupe_key`);--> statement-breakpoint
ALTER TABLE `ai_calls` ADD `input_fp` text;--> statement-breakpoint
ALTER TABLE `ai_calls` ADD `output_fp` text;--> statement-breakpoint
CREATE INDEX `ai_calls_kind_input_fp_idx` ON `ai_calls` (`kind`,`input_fp`);--> statement-breakpoint
ALTER TABLE `neurons` ADD `hidden` integer DEFAULT false NOT NULL;