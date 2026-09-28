-- Catégories de départ (couleurs lisibles en AA sur fond clair ; variantes sombres gérées par l'interface).
INSERT INTO `categories` (`id`, `slug`, `label`, `color`, `sort_order`) VALUES
  ('cat-general', 'general', 'Général', '#475569', 1),
  ('cat-achat', 'achat', 'Achat', '#b45309', 2),
  ('cat-projet', 'projet', 'Projet', '#6d28d9', 3),
  ('cat-sortie', 'sortie', 'Sortie', '#0f766e', 4),
  ('cat-photo', 'photo', 'Photo', '#be185d', 5),
  ('cat-it', 'it', 'IT', '#1d4ed8', 6);
--> statement-breakpoint
INSERT INTO `settings` (`key`, `value_json`) VALUES
  ('neurons.max_ai_depth', '6'),
  ('neurons.min_extensions', '3');
--> statement-breakpoint
-- Recherche plein texte sur les idées (racines uniquement), tenue à jour par des déclencheurs.
CREATE VIRTUAL TABLE `neurons_fts` USING fts5(`neuron_id` UNINDEXED, `title`, `content`, tokenize = 'unicode61 remove_diacritics 2');
--> statement-breakpoint
CREATE TRIGGER `neurons_fts_insert` AFTER INSERT ON `neurons` WHEN new.`kind` = 'root' BEGIN
  INSERT INTO `neurons_fts` (`neuron_id`, `title`, `content`) VALUES (new.`id`, new.`title`, coalesce(new.`content`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `neurons_fts_update` AFTER UPDATE OF `title`, `content` ON `neurons` WHEN new.`kind` = 'root' BEGIN
  DELETE FROM `neurons_fts` WHERE `neuron_id` = old.`id`;
  INSERT INTO `neurons_fts` (`neuron_id`, `title`, `content`) VALUES (new.`id`, new.`title`, coalesce(new.`content`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `neurons_fts_delete` AFTER DELETE ON `neurons` WHEN old.`kind` = 'root' BEGIN
  DELETE FROM `neurons_fts` WHERE `neuron_id` = old.`id`;
END;
