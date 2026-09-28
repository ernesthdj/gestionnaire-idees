-- Annulation de 0001_cache_write_tokens.sql (SQLite >= 3.35 : DROP COLUMN).
ALTER TABLE `ai_calls` DROP COLUMN `cache_write_tokens`;
