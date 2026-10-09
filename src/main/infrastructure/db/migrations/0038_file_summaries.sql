CREATE TABLE `code_file_summaries` (
	`genesis_id` text NOT NULL,
	`path` text NOT NULL,
	`content_hash` text NOT NULL,
	`summary_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`genesis_id`, `path`)
);
