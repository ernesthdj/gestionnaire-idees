CREATE TABLE `git_author_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`alias_key` text NOT NULL,
	`main_key` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `git_author_aliases_unique` ON `git_author_aliases` (`genesis_id`,`alias_key`);--> statement-breakpoint
CREATE TABLE `git_clones_running` (
	`id` text PRIMARY KEY NOT NULL,
	`target_dir` text NOT NULL,
	`profile` text NOT NULL,
	`started_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `git_conflict_hunks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`path` text NOT NULL,
	`hunk_index` integer NOT NULL,
	`proposal` text,
	`explanation` text,
	`confidence` text,
	`decision` text,
	`manual_text` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `git_merge_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `git_conflict_hunks_unique` ON `git_conflict_hunks` (`session_id`,`path`,`hunk_index`);--> statement-breakpoint
CREATE TABLE `git_issue_links` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`kind` text NOT NULL,
	`number` integer NOT NULL,
	`neuron_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`neuron_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `git_issue_links_genesis_idx` ON `git_issue_links` (`genesis_id`);--> statement-breakpoint
CREATE TABLE `git_merge_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`merge_head` text NOT NULL,
	`head` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`outcome` text,
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `git_merge_sessions_genesis_idx` ON `git_merge_sessions` (`genesis_id`);--> statement-breakpoint
CREATE TABLE `git_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`commit_hash` text,
	`branch` text,
	`remote` text,
	`host` text,
	`number` integer,
	`count` integer,
	`started_at` text NOT NULL,
	`finished_at` text NOT NULL,
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `git_operations_genesis_idx` ON `git_operations` (`genesis_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `git_repos` (
	`genesis_id` text PRIMARY KEY NOT NULL,
	`default_remote` text,
	`remote_url` text,
	`github_repo` text,
	`upstream_repo` text,
	`last_fetch_at` text,
	`last_seen_commit` text,
	`sensitive_checked_head` text,
	`cloned` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
