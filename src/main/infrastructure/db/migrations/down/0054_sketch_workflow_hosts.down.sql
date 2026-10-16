-- Annulation de 0054_sketch_workflow_hosts.sql (L1o D14, agents connectés aux nœuds du Workflow) : la clé étrangère
-- vers `neurons` revient, et les croquis d'une tâche ou d'un document du Workflow (clé `wf:…`) sont perdus.
CREATE TABLE `__old_assembly_sketches` (
	`node_id` text PRIMARY KEY NOT NULL,
	`genesis_id` text NOT NULL,
	`task_id` text NOT NULL,
	`task` text,
	`agents` text DEFAULT '[]' NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `neurons`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO `__old_assembly_sketches` SELECT * FROM `assembly_sketches` WHERE `node_id` IN (SELECT `id` FROM `neurons`);
DROP TABLE `assembly_sketches`;
ALTER TABLE `__old_assembly_sketches` RENAME TO `assembly_sketches`;
CREATE INDEX `assembly_sketches_genesis_idx` ON `assembly_sketches` (`genesis_id`);
