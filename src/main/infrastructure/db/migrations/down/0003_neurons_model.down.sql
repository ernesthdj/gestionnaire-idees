-- Annulation de 0003_neurons_model.sql (dépendances d'abord ; les index tombent avec leurs tables).
DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `change_log`;
DROP TABLE IF EXISTS `neuron_links`;
DROP TABLE IF EXISTS `reflection_summaries`;
DROP TABLE IF EXISTS `plan_dependencies`;
DROP TABLE IF EXISTS `plan_nodes`;
DROP TABLE IF EXISTS `syntheses`;
DROP TABLE IF EXISTS `context_assessments`;
DROP TABLE IF EXISTS `extensions`;
DROP TABLE IF EXISTS `neurons`;
DROP TABLE IF EXISTS `categories`;
