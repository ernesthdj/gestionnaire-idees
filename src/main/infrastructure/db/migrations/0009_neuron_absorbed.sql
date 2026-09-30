ALTER TABLE `neurons` ADD `absorbed_in` text;--> statement-breakpoint
-- Rattrapage : les idées déjà écloses rangent leurs sous-neurones dans leur dernière synthèse confirmée.
UPDATE `neurons` SET `absorbed_in` = (
	SELECT `s`.`id` FROM `syntheses` `s`
	WHERE `s`.`root_id` = `neurons`.`root_id` AND `s`.`status` = 'confirmed'
	ORDER BY `s`.`decided_at` DESC LIMIT 1
)
WHERE `kind` <> 'root'
	AND `root_id` IN (SELECT `id` FROM `neurons` WHERE `kind` = 'root' AND `state` = 'hatched');
--> statement-breakpoint
UPDATE `extensions` SET `status` = 'dismissed', `resolved_at` = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE `status` = 'proposed'
	AND `root_id` IN (SELECT `id` FROM `neurons` WHERE `kind` = 'root' AND `state` = 'hatched');
