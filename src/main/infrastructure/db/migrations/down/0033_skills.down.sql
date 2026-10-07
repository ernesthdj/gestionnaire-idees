-- Annulation de 0033_skills.sql (spec 020). Fiches, domaines, liens, brouillons, versions et imports sont perdus
-- (les skills sur le disque et les dossiers de versions du profil restent intacts).
DROP INDEX IF EXISTS `skill_versions_skill_idx`;
DROP TABLE IF EXISTS `skill_versions`;
DROP INDEX IF EXISTS `skill_drafts_status_idx`;
DROP TABLE IF EXISTS `skill_drafts`;
DROP INDEX IF EXISTS `skill_import_candidates_import_idx`;
DROP TABLE IF EXISTS `skill_import_candidates`;
DROP TABLE IF EXISTS `skill_imports`;
DROP INDEX IF EXISTS `skill_links_unique`;
DROP TABLE IF EXISTS `skill_links`;
DROP TABLE IF EXISTS `skill_cards`;
DROP TABLE IF EXISTS `skill_domains`;
