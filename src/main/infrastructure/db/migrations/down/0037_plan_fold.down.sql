-- Annulation de 0037_plan_fold.sql (spec 022 D14) : le repli des plans sur la carte n'est plus gardé.
ALTER TABLE `neurons` DROP COLUMN `plan_folded`;
