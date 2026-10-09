-- Annulation de 0040_brainstorms.sql (spec 024) : un canevas par brainstorm retiré, tout redevient une seule carte.
DROP INDEX `neurons_brainstorm_idx`;
ALTER TABLE `neurons` DROP COLUMN `brainstorm_id`;
DROP INDEX `canvas_blocks_brainstorm_idx`;
ALTER TABLE `canvas_blocks` DROP COLUMN `brainstorm_id`;
DROP TABLE `save_points`;
DROP TABLE `brainstorms`;
