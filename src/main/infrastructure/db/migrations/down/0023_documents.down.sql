-- Annulation de 0023_documents.sql (spec 012). Les fichiers .md sur le disque ne sont pas touchés.
DROP INDEX IF EXISTS `document_versions_document_idx`;
DROP TABLE IF EXISTS `document_versions`;
DROP INDEX IF EXISTS `documents_genesis_idx`;
DROP INDEX IF EXISTS `documents_neuron_idx`;
DROP TABLE IF EXISTS `documents`;
