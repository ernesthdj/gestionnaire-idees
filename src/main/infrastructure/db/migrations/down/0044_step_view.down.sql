-- Annulation de 0044_step_view.sql : vue de naissance des étapes retirée (spec 023 D19).
ALTER TABLE `neurons` DROP COLUMN `structure_view`;
