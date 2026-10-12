CREATE TABLE `folders` (
	`neuron_id` text PRIMARY KEY NOT NULL,
	`offset_x` real DEFAULT 0 NOT NULL,
	`offset_y` real DEFAULT 0 NOT NULL,
	`moved` integer DEFAULT false NOT NULL,
	`seen_at` text,
	FOREIGN KEY (`neuron_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Reprise des documents de la spec 012 (spec 028 D4, research R11) : un document arrangé à la main (déplacé ou
-- redimensionné) reste affiché à sa place, épinglé ; les autres passent dans le dossier de leur nœud.
UPDATE `documents` SET `pinned` = 1
WHERE `deleted_at` IS NULL AND (`offset_x` <> 0 OR `offset_y` <> 0 OR `width` <> 360 OR `height` <> 280);
--> statement-breakpoint
-- Dossiers des nœuds qui ont déjà des documents : vus maintenant, aucun ancien document n'est « nouveau ».
INSERT OR IGNORE INTO `folders` (`neuron_id`, `seen_at`)
SELECT DISTINCT `neuron_id`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `documents` WHERE `deleted_at` IS NULL;
