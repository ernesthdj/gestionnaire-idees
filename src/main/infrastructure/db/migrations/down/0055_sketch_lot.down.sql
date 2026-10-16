-- Annulation de 0055_sketch_lot.sql (L1o D25, le PO cadre un lot) : le plan du PO et les aiguillages retouchés des lots
-- sont perdus, les équipes restent.
ALTER TABLE `assembly_sketches` DROP COLUMN `lot`;
