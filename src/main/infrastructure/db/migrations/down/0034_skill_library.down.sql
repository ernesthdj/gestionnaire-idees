-- Annulation de 0034_skill_library.sql (spec 020 D12). Les dépôts de la bibliothèque perdent leur dossier et leurs
-- audits par Claude ; les copies sur le disque (`<profil>/skill-library`) sont à supprimer à la main.
ALTER TABLE `skill_imports` DROP COLUMN `truncated`;
ALTER TABLE `skill_imports` DROP COLUMN `updated_at`;
ALTER TABLE `skill_imports` DROP COLUMN `folder`;
ALTER TABLE `skill_import_candidates` DROP COLUMN `claude_hash`;
ALTER TABLE `skill_import_candidates` DROP COLUMN `claude_reasons`;
ALTER TABLE `skill_import_candidates` DROP COLUMN `claude_verdict`;
ALTER TABLE `skill_import_candidates` DROP COLUMN `content_hash`;
