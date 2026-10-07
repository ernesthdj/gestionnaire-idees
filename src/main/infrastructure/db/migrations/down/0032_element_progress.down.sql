-- Annulation de 0032_element_progress.sql (spec 017 D21). L'avancement déclaré par Claude est perdu, le statut reste.
ALTER TABLE `neurons` DROP COLUMN `progress_note`;
ALTER TABLE `neurons` DROP COLUMN `progress`;
