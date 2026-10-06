-- Annulation de 0027_claude_libre.sql (spec 014). Les règles « Toujours », la confiance et le journal des décisions
-- sont perdus. Les fichiers et commits des projets liés ne sont pas touchés.
ALTER TABLE `neurons` DROP COLUMN `chat_bypass_confirmed_at`;
ALTER TABLE `neurons` DROP COLUMN `chat_extra_dirs_json`;
ALTER TABLE `neurons` DROP COLUMN `chat_permission_mode`;
ALTER TABLE `neuron_messages` DROP COLUMN `tool_reason`;
ALTER TABLE `neuron_messages` DROP COLUMN `tool_status`;
ALTER TABLE `neuron_messages` DROP COLUMN `tool_use_id`;
ALTER TABLE `final_actions` DROP COLUMN `committed_at`;
ALTER TABLE `final_actions` DROP COLUMN `committed_hash`;
DROP TABLE IF EXISTS `trusted_projects`;
DROP INDEX IF EXISTS `permission_rules_project_idx`;
DROP TABLE IF EXISTS `permission_rules`;
DROP INDEX IF EXISTS `permission_log_neuron_idx`;
DROP TABLE IF EXISTS `permission_log`;
