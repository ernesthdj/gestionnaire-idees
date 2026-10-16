CREATE TABLE `agent_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`permission_mode` text NOT NULL,
	`model` text NOT NULL,
	`effort` text NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_profiles_name_unique` ON `agent_profiles` (`name`);