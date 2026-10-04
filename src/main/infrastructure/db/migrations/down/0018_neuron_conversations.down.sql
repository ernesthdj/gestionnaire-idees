-- Annulation de 0018_neuron_conversations.sql (spec 008).
DROP INDEX IF EXISTS `neurons_session_id_unique`;
ALTER TABLE `neurons` DROP COLUMN `sheet_json`;
ALTER TABLE `neurons` DROP COLUMN `session_started`;
ALTER TABLE `neurons` DROP COLUMN `session_id`;
DROP INDEX IF EXISTS `neuron_messages_neuron_idx`;
DROP TABLE IF EXISTS `neuron_messages`;
