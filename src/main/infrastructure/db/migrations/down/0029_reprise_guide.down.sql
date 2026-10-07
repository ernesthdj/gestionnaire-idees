-- Annulation de 0029_reprise_guide.sql (spec 017 US4). Le lien vers le document du guide est perdu, le document
-- et ses versions restent dans le genesis.
ALTER TABLE `code_projects` DROP COLUMN `guide_document_id`;
