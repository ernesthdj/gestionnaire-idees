-- Annulation de 0050_agent_profiles.sql (T001 Pipelines d'agents) : les profils d'agents sont perdus.
DROP INDEX `agent_profiles_name_unique`;
DROP TABLE `agent_profiles`;
