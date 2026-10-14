-- Annulation de 0049_file_summaries.sql (spec 031 lot 1b) : le rôle de chaque fichier, écrit par Claude avec le guide
-- de reprise, est perdu ; régénérer le guide le réécrit.
ALTER TABLE `code_files` DROP COLUMN `summary`;
