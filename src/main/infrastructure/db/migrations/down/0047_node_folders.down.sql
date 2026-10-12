-- Annulation de 0047_node_folders.sql (spec 028) : les documents redeviennent des nœuds sous leur neurone (spec 012
-- D4) ; places et ouvertures des dossiers perdues.
ALTER TABLE `documents` DROP COLUMN `pinned`;
DROP TABLE `folders`;
