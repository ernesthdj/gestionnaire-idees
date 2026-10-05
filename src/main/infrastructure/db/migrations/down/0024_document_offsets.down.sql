-- Annulation de 0024_document_offsets.sql (spec 012).
ALTER TABLE `documents` DROP COLUMN `offset_y`;
ALTER TABLE `documents` DROP COLUMN `offset_x`;
