-- Annulation de 0004_neurons_seed_fts.sql.
DROP TRIGGER IF EXISTS `neurons_fts_delete`;
DROP TRIGGER IF EXISTS `neurons_fts_update`;
DROP TRIGGER IF EXISTS `neurons_fts_insert`;
DROP TABLE IF EXISTS `neurons_fts`;
DELETE FROM `settings` WHERE `key` IN ('neurons.max_ai_depth', 'neurons.min_extensions');
DELETE FROM `categories` WHERE `id` IN ('cat-general', 'cat-achat', 'cat-projet', 'cat-sortie', 'cat-photo', 'cat-it');
