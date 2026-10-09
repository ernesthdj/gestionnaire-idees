-- Annulation de 0041_mapped_commit.sql : repère de la dernière cartographie retiré.
ALTER TABLE `git_repos` DROP COLUMN `mapped_commit`;
