-- Annulation de 0051_tool_files.sql (spec 014 D9) : les pastilles de fichier du chat ne s'ouvrent plus.
ALTER TABLE `neuron_messages` DROP COLUMN `tool_patch`;
ALTER TABLE `neuron_messages` DROP COLUMN `tool_path`;
