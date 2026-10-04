ALTER TABLE `map_links` ADD `relation` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `genesis_id` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `element_type` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `element_key` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `element_status` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `paths_json` text;--> statement-breakpoint
ALTER TABLE `neurons` ADD `collapsed` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `neurons_element_key_idx` ON `neurons` (`genesis_id`,`element_key`);--> statement-breakpoint
CREATE INDEX `neurons_genesis_idx` ON `neurons` (`genesis_id`);