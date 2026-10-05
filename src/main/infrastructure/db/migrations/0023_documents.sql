CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`content` text NOT NULL,
	`hash` text NOT NULL,
	`author` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `document_versions_document_idx` ON `document_versions` (`document_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`neuron_id` text NOT NULL,
	`genesis_id` text NOT NULL,
	`title` text NOT NULL,
	`folder` text NOT NULL,
	`file_name` text NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`origin` text NOT NULL,
	`current_version_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`neuron_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`genesis_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `documents_neuron_idx` ON `documents` (`neuron_id`);--> statement-breakpoint
CREATE INDEX `documents_genesis_idx` ON `documents` (`genesis_id`);