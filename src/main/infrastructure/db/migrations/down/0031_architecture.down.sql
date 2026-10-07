-- Annulation de 0031_architecture.sql (spec 017 D20). Les couches et architectures données par Claude ou corrigées
-- par mentalyas sont perdues, la carte de structure reste.
ALTER TABLE `neurons` DROP COLUMN `architecture_source`;
ALTER TABLE `neurons` DROP COLUMN `architecture_reason`;
ALTER TABLE `neurons` DROP COLUMN `architecture`;
ALTER TABLE `neurons` DROP COLUMN `layer_source`;
ALTER TABLE `neurons` DROP COLUMN `layer`;
