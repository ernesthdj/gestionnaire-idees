-- Annulation de 0035_skill_library_copies.sql (spec 020 D12) : le nombre de copies écartées n'est plus affiché.
ALTER TABLE `skill_imports` DROP COLUMN `skipped_copies`;
