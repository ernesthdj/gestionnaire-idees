CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `change_log` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`kind` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`undone_by_batch` text
);
--> statement-breakpoint
CREATE INDEX `change_log_batch_idx` ON `change_log` (`batch_id`);--> statement-breakpoint
CREATE TABLE `context_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`level` text NOT NULL,
	`ai_level` text NOT NULL,
	`covered_json` text NOT NULL,
	`missing_json` text NOT NULL,
	`answered_count` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `context_assessments_root_idx` ON `context_assessments` (`root_id`);--> statement-breakpoint
CREATE TABLE `extensions` (
	`id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`neuron_id` text NOT NULL,
	`question` text NOT NULL,
	`quick_replies_json` text DEFAULT '[]' NOT NULL,
	`dimension` text NOT NULL,
	`answer_kind` text,
	`status` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`neuron_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `extensions_root_status_idx` ON `extensions` (`root_id`,`status`);--> statement-breakpoint
CREATE TABLE `neuron_links` (
	`id` text PRIMARY KEY NOT NULL,
	`a_root_id` text NOT NULL,
	`b_root_id` text NOT NULL,
	`label` text NOT NULL,
	`justification` text,
	`origin` text NOT NULL,
	`status` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`decided_at` text
);
--> statement-breakpoint
CREATE INDEX `neuron_links_status_idx` ON `neuron_links` (`status`);--> statement-breakpoint
CREATE INDEX `neuron_links_fingerprint_idx` ON `neuron_links` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `neurons` (
	`id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`parent_id` text,
	`depth` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`amount_cents` integer,
	`due_date` text,
	`origin` text NOT NULL,
	`from_extension_id` text,
	`nature` text,
	`nature_source` text,
	`category_id` text,
	`category_source` text,
	`state` text,
	`version` integer DEFAULT 0 NOT NULL,
	`pos_x` real,
	`pos_y` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`parent_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `neurons_from_extension_id_unique` ON `neurons` (`from_extension_id`);--> statement-breakpoint
CREATE INDEX `neurons_root_idx` ON `neurons` (`root_id`);--> statement-breakpoint
CREATE INDEX `neurons_parent_idx` ON `neurons` (`parent_id`);--> statement-breakpoint
CREATE INDEX `neurons_state_idx` ON `neurons` (`state`);--> statement-breakpoint
CREATE INDEX `neurons_nature_idx` ON `neurons` (`nature`);--> statement-breakpoint
CREATE INDEX `neurons_category_idx` ON `neurons` (`category_id`);--> statement-breakpoint
CREATE TABLE `plan_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`kind` text NOT NULL,
	`trigger_label` text,
	`trigger_reached_at` text,
	FOREIGN KEY (`from_node_id`) REFERENCES `plan_nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_node_id`) REFERENCES `plan_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_dependencies_pair_idx` ON `plan_dependencies` (`from_node_id`,`to_node_id`);--> statement-breakpoint
CREATE TABLE `plan_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`synthesis_id` text NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`question` text,
	`branch_label` text,
	`active_branch` integer DEFAULT true NOT NULL,
	`amount_cents` integer,
	`due_date` text,
	`status` text NOT NULL,
	`investigation` integer DEFAULT false NOT NULL,
	`to_schedule` integer DEFAULT false NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`pos_x` real,
	`pos_y` real
);
--> statement-breakpoint
CREATE INDEX `plan_nodes_root_idx` ON `plan_nodes` (`root_id`);--> statement-breakpoint
CREATE TABLE `reflection_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`synthesis_id` text NOT NULL,
	`key_points_json` text NOT NULL,
	`decisions_json` text NOT NULL,
	`pros_json` text NOT NULL,
	`cons_json` text NOT NULL,
	`open_questions_json` text NOT NULL,
	`is_current` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reflection_summaries_root_idx` ON `reflection_summaries` (`root_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `syntheses` (
	`id` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`base_version` integer NOT NULL,
	`instruction` text,
	`forced` integer DEFAULT false NOT NULL,
	`degraded` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`batch_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`decided_at` text
);
--> statement-breakpoint
CREATE INDEX `syntheses_root_status_idx` ON `syntheses` (`root_id`,`status`);