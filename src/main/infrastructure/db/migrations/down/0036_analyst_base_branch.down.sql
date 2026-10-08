-- Annulation de 0036_analyst_base_branch.sql (spec 019 US4) : la branche de base des mises à jour n'est plus gardée.
ALTER TABLE `analyst_updates` DROP COLUMN `base_branch`;
