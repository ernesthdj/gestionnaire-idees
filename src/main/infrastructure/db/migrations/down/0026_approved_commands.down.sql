-- Annulation de 0026_approved_commands.sql (spec 013 D2 bis).
DROP INDEX IF EXISTS `command_runs_execution_idx`;
DROP TABLE IF EXISTS `command_runs`;
DROP TABLE IF EXISTS `approved_commands`;
