ALTER TABLE `skill_import_candidates` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `skill_import_candidates` ADD `claude_verdict` text;--> statement-breakpoint
ALTER TABLE `skill_import_candidates` ADD `claude_reasons` text;--> statement-breakpoint
ALTER TABLE `skill_import_candidates` ADD `claude_hash` text;--> statement-breakpoint
ALTER TABLE `skill_imports` ADD `folder` text;--> statement-breakpoint
ALTER TABLE `skill_imports` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `skill_imports` ADD `truncated` integer DEFAULT false NOT NULL;