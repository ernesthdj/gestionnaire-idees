CREATE TABLE `code_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`from_symbol_id` text NOT NULL,
	`to_symbol_id` text,
	`raw_target` text NOT NULL,
	`kind` text NOT NULL,
	`provenance` text NOT NULL,
	`reason` text,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `code_edges_from_idx` ON `code_edges` (`from_symbol_id`);--> statement-breakpoint
CREATE INDEX `code_edges_to_idx` ON `code_edges` (`to_symbol_id`);--> statement-breakpoint
CREATE INDEX `code_edges_provenance_idx` ON `code_edges` (`genesis_id`,`provenance`);--> statement-breakpoint
CREATE TABLE `code_entry_points` (
	`symbol_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `code_explorer_state` (
	`genesis_id` text PRIMARY KEY NOT NULL,
	`filters_json` text NOT NULL,
	`last_level` integer DEFAULT 1 NOT NULL,
	`last_parent_key` text
);
--> statement-breakpoint
CREATE TABLE `code_files` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`module_id` text,
	`path` text NOT NULL,
	`lang` text NOT NULL,
	`hash` text NOT NULL,
	`lines` integer NOT NULL,
	`status` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `code_files_path_idx` ON `code_files` (`genesis_id`,`path`);--> statement-breakpoint
CREATE INDEX `code_files_module_idx` ON `code_files` (`module_id`);--> statement-breakpoint
CREATE TABLE `code_layout` (
	`genesis_id` text NOT NULL,
	`level` integer NOT NULL,
	`parent_key` text NOT NULL,
	`node_key` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	PRIMARY KEY(`genesis_id`, `level`, `parent_key`, `node_key`)
);
--> statement-breakpoint
CREATE TABLE `code_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`root_path` text NOT NULL,
	`kind` text NOT NULL,
	`summary` text,
	`analogy` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `code_modules_key_idx` ON `code_modules` (`genesis_id`,`key`);--> statement-breakpoint
CREATE TABLE `code_overrides` (
	`genesis_id` text NOT NULL,
	`target` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`genesis_id`, `target`)
);
--> statement-breakpoint
CREATE TABLE `code_projects` (
	`genesis_id` text PRIMARY KEY NOT NULL,
	`root_dir` text NOT NULL,
	`source` text NOT NULL,
	`remote_url` text,
	`confidentiality` text NOT NULL,
	`confidentiality_changed_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`analysis_state` text DEFAULT 'idle' NOT NULL,
	`analyzed_at` text,
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `code_projects_root_idx` ON `code_projects` (`root_dir`);--> statement-breakpoint
CREATE TABLE `code_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`kind` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`state` text NOT NULL,
	`stats_json` text
);
--> statement-breakpoint
CREATE INDEX `code_runs_genesis_idx` ON `code_runs` (`genesis_id`);--> statement-breakpoint
CREATE TABLE `code_symbols` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`qualified_name` text NOT NULL,
	`start_line` integer NOT NULL,
	`end_line` integer NOT NULL,
	`complexity` integer DEFAULT 1 NOT NULL,
	`category` text NOT NULL,
	`category_source` text NOT NULL,
	`category_reason` text
);
--> statement-breakpoint
CREATE INDEX `code_symbols_file_idx` ON `code_symbols` (`file_id`);--> statement-breakpoint
CREATE INDEX `code_symbols_qualified_idx` ON `code_symbols` (`file_id`,`qualified_name`);