CREATE TABLE `skill_cards` (
	`skill_id` text PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`card` text NOT NULL,
	`grid` text NOT NULL,
	`stars_claude` integer NOT NULL,
	`stars_user` integer,
	`domain_id` text,
	`domain_source` text NOT NULL,
	`analyzed_at` integer NOT NULL,
	`model` text NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `skill_domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `skill_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`pending` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`project_genesis_id` text,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`content` text NOT NULL,
	`annexes` text DEFAULT '[]' NOT NULL,
	`allowed_scripts` text DEFAULT '[]' NOT NULL,
	`base_hash` text,
	`origin` text NOT NULL,
	`import_id` text,
	`source` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `skill_imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `skill_drafts_status_idx` ON `skill_drafts` (`status`,`family`,`name`);--> statement-breakpoint
CREATE TABLE `skill_import_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`name` text NOT NULL,
	`rel_dir` text NOT NULL,
	`files` text NOT NULL,
	`verdict` text NOT NULL,
	`reasons` text NOT NULL,
	`kept` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `skill_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_import_candidates_import_idx` ON `skill_import_candidates` (`import_id`);--> statement-breakpoint
CREATE TABLE `skill_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`commit` text,
	`status` text NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE TABLE `skill_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`kind` text NOT NULL,
	`origin` text NOT NULL,
	`reason` text,
	`removed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_links_unique` ON `skill_links` (`from_id`,`to_id`,`kind`);--> statement-breakpoint
CREATE TABLE `skill_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`folder` text NOT NULL,
	`content_hash` text NOT NULL,
	`batch_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `skill_versions_skill_idx` ON `skill_versions` (`skill_id`,`created_at`);--> statement-breakpoint
INSERT INTO `skill_domains` (`id`, `label`, `position`, `pending`) VALUES ('projet', 'Projet & organisation', 0, 0), ('design', 'Design & UI', 1, 0), ('docs', 'Docs & cours', 2, 0), ('code', 'Code & qualité', 3, 0), ('donnees', 'Données & IA', 4, 0), ('media', 'Photo & médias', 5, 0), ('divers', 'Divers', 6, 0);
