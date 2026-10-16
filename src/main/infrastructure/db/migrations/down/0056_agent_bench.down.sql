-- Annulation de 0056_agent_bench.sql (L1o D26, agents posés libres sur la carte) : les agents libres sont perdus, les
-- équipes connectées aux nœuds restent.
DROP INDEX IF EXISTS `agent_bench_genesis_idx`;
DROP TABLE `agent_bench`;
