CREATE TABLE `agent_bench` (
	`id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `agent_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_bench_genesis_idx` ON `agent_bench` (`genesis_id`);