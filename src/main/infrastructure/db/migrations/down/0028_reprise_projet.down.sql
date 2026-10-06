-- Annulation de 0028_reprise_projet.sql (spec 017). Le graphe des projets repris, les corrections de mentalyas et
-- l'état de l'explorateur sont perdus. Les genesis restent (neurones ordinaires liés à leur dossier), les guides
-- restent des documents, et les dossiers des projets ne sont pas touchés.
DROP INDEX IF EXISTS `code_symbols_qualified_idx`;
DROP INDEX IF EXISTS `code_symbols_file_idx`;
DROP TABLE IF EXISTS `code_symbols`;
DROP INDEX IF EXISTS `code_runs_genesis_idx`;
DROP TABLE IF EXISTS `code_runs`;
DROP INDEX IF EXISTS `code_projects_root_idx`;
DROP TABLE IF EXISTS `code_projects`;
DROP TABLE IF EXISTS `code_overrides`;
DROP INDEX IF EXISTS `code_modules_key_idx`;
DROP TABLE IF EXISTS `code_modules`;
DROP TABLE IF EXISTS `code_layout`;
DROP INDEX IF EXISTS `code_files_module_idx`;
DROP INDEX IF EXISTS `code_files_path_idx`;
DROP TABLE IF EXISTS `code_files`;
DROP TABLE IF EXISTS `code_explorer_state`;
DROP TABLE IF EXISTS `code_entry_points`;
DROP INDEX IF EXISTS `code_edges_provenance_idx`;
DROP INDEX IF EXISTS `code_edges_to_idx`;
DROP INDEX IF EXISTS `code_edges_from_idx`;
DROP TABLE IF EXISTS `code_edges`;
