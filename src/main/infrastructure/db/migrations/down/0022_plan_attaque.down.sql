-- Annulation de 0022_plan_attaque.sql (spec 011).
DROP INDEX IF EXISTS `neurons_parent_rank_idx`;
ALTER TABLE `neurons` DROP COLUMN `lock_proposed_at`;
ALTER TABLE `neurons` DROP COLUMN `locked_at`;
ALTER TABLE `neurons` DROP COLUMN `step_status`;
ALTER TABLE `neurons` DROP COLUMN `rank`;
DROP INDEX IF EXISTS `step_dependencies_waits_idx`;
DROP TABLE IF EXISTS `step_dependencies`;
DROP INDEX IF EXISTS `plan_proposal_items_proposal_idx`;
DROP TABLE IF EXISTS `plan_proposal_items`;
DROP INDEX IF EXISTS `plan_proposals_parent_idx`;
DROP TABLE IF EXISTS `plan_proposals`;
