-- Annulation de 0030_analyste.sql (spec 019). Les observations, analyses, propositions et mises à jour de l'Analyste
-- sont perdues, les branches `analyste/*` du dépôt ne sont pas touchées. Index retiré avant sa colonne (SQLite).
DROP TABLE IF EXISTS `analyst_updates`;
DROP TABLE IF EXISTS `proposals`;
DROP TABLE IF EXISTS `analyses`;
DROP TABLE IF EXISTS `observations`;
DROP INDEX IF EXISTS `ai_calls_kind_input_fp_idx`;
ALTER TABLE `ai_calls` DROP COLUMN `output_fp`;
ALTER TABLE `ai_calls` DROP COLUMN `input_fp`;
ALTER TABLE `neurons` DROP COLUMN `hidden`;
