-- Annulation de 0048_folder_entries.sql (spec 028 lot 2) : les fichiers rangés à la main ou écrits en conversation
-- quittent les dossiers (les fichiers eux-mêmes restent sur le disque) ; les fichiers couverts masqués réapparaissent.
DROP INDEX IF EXISTS `folder_entries_neuron_idx`;
DROP INDEX IF EXISTS `folder_entries_path_idx`;
DROP TABLE `folder_entries`;
