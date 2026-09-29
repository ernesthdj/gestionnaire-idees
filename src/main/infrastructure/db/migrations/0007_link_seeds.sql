CREATE TABLE `link_seeds` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`title` text NOT NULL,
	`why` text NOT NULL,
	`status` text NOT NULL,
	`born_root_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`link_id`) REFERENCES `neuron_links`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`born_root_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `link_seeds_link_id_unique` ON `link_seeds` (`link_id`);