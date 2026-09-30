-- Annulation de 0012_idea_summary.sql.
ALTER TABLE `neurons` DROP COLUMN `summary_version`;--> statement-breakpoint
ALTER TABLE `neurons` DROP COLUMN `summary`;
