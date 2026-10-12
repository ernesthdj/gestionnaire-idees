-- Annulation de 0046_reprise_edge_candidates.sql (spec 017 US6). Les cibles possibles des liens incertains sont
-- perdues, une nouvelle analyse du projet les recalcule.
ALTER TABLE `code_edges` DROP COLUMN `candidates_json`;
