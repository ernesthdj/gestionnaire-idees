-- Annulation de 0025_final_actions.sql (spec 013). Les fichiers écrits dans les projets liés ne sont pas touchés.
DROP INDEX IF EXISTS `deliverable_files_path_idx`;
DROP TABLE IF EXISTS `deliverable_files`;
DROP INDEX IF EXISTS `execution_events_execution_idx`;
DROP TABLE IF EXISTS `execution_events`;
DROP INDEX IF EXISTS `executions_open_genesis_idx`;
DROP INDEX IF EXISTS `executions_neuron_idx`;
DROP TABLE IF EXISTS `executions`;
DROP INDEX IF EXISTS `final_actions_genesis_idx`;
DROP TABLE IF EXISTS `final_actions`;
