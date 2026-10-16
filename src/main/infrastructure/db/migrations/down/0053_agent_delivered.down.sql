-- Annulation de 0053_agent_delivered.sql (T008 Personnages évolutifs des agents) : le travail livré des profils est perdu.
ALTER TABLE `agent_profiles` DROP COLUMN `delivered`;
