CREATE TABLE `plan_proposal_items` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`why` text NOT NULL,
	`rank` integer NOT NULL,
	`waits_for_json` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`born_id` text,
	FOREIGN KEY (`proposal_id`) REFERENCES `plan_proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plan_proposal_items_proposal_idx` ON `plan_proposal_items` (`proposal_id`);--> statement-breakpoint
CREATE TABLE `plan_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plan_proposals_parent_idx` ON `plan_proposals` (`parent_id`,`status`);--> statement-breakpoint
CREATE TABLE `step_dependencies` (
	`step_id` text NOT NULL,
	`waits_for_id` text NOT NULL,
	PRIMARY KEY(`step_id`, `waits_for_id`),
	FOREIGN KEY (`step_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`waits_for_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `step_dependencies_waits_idx` ON `step_dependencies` (`waits_for_id`);--> statement-breakpoint
ALTER TABLE `neurons` ADD `rank` integer;--> statement-breakpoint
ALTER TABLE `neurons` ADD `step_status` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `locked_at` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `lock_proposed_at` text;--> statement-breakpoint
CREATE INDEX `neurons_parent_rank_idx` ON `neurons` (`parent_id`,`rank`);