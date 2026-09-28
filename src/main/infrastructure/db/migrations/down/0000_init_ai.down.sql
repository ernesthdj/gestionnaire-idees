-- Annulation de 0000_init_ai.sql (ordre inverse, dépendances d'abord).
DROP INDEX IF EXISTS `examples_task_kind_idx`;
DROP TABLE IF EXISTS `examples`;
DROP INDEX IF EXISTS `context_versions_single_active_idx`;
DROP TABLE IF EXISTS `context_versions`;
DROP INDEX IF EXISTS `context_imports_status_idx`;
DROP TABLE IF EXISTS `context_imports`;
DROP INDEX IF EXISTS `ai_pending_requests_created_at_idx`;
DROP INDEX IF EXISTS `ai_pending_requests_request_id_unique`;
DROP TABLE IF EXISTS `ai_pending_requests`;
DROP TABLE IF EXISTS `ai_config`;
DROP INDEX IF EXISTS `ai_calls_engine_created_at_idx`;
DROP INDEX IF EXISTS `ai_calls_created_at_idx`;
DROP TABLE IF EXISTS `ai_calls`;
