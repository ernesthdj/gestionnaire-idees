CREATE TABLE `ai_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`kind` text NOT NULL,
	`engine` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cost_millicents` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_calls_created_at_idx` ON `ai_calls` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_calls_engine_created_at_idx` ON `ai_calls` (`engine`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_pending_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_pending_requests_request_id_unique` ON `ai_pending_requests` (`request_id`);--> statement-breakpoint
CREATE INDEX `ai_pending_requests_created_at_idx` ON `ai_pending_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `context_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`detected_at` text NOT NULL,
	`manifest_json` text NOT NULL,
	`diff_json` text,
	`status` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `context_imports_status_idx` ON `context_imports` (`status`);--> statement-breakpoint
CREATE TABLE `context_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`profile_md` text DEFAULT '' NOT NULL,
	`rules_md` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`import_id` text,
	`is_active` integer DEFAULT false NOT NULL,
	`applied_at` text NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `context_imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `context_versions_single_active_idx` ON `context_versions` (`is_active`) WHERE "context_versions"."is_active" = 1;--> statement-breakpoint
CREATE TABLE `examples` (
	`id` text PRIMARY KEY NOT NULL,
	`polarity` text NOT NULL,
	`task_kind` text NOT NULL,
	`content_json` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `examples_task_kind_idx` ON `examples` (`task_kind`);