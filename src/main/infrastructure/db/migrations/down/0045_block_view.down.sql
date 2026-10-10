-- Annulation de 0045_block_view.sql : vue de naissance des blocs retirée (spec 023 D25).
ALTER TABLE `canvas_blocks` DROP COLUMN `structure_view`;
