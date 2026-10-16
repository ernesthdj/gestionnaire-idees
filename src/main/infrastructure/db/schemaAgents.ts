import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** Profils d'agents des pipelines (docs/TACHES-AGENTS.md T001, migration 0050). Dates en millisecondes. */
export const agentProfiles = sqliteTable(
  'agent_profiles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    role: text('role', { enum: ['po', 'architecte', 'backend', 'frontend', 'qa', 'autre'] }).notNull(),
    instructions: text('instructions').notNull().default(''),
    permissionMode: text('permission_mode', { enum: ['default', 'acceptEdits', 'bypassPermissions'] }).notNull(),
    model: text('model').notNull(),
    effort: text('effort', { enum: ['low', 'medium', 'high', 'xhigh', 'max'] }).notNull(),
    /** Identifiants de skills consultables (JSON : string[]). */
    skills: text('skills').notNull().default('[]'),
    /** Travail livré (assemblages validés, fusions acceptées) : enrichit la chambre de l'agent (L1o D13, migration 0053). */
    delivered: integer('delivered').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [uniqueIndex('agent_profiles_name_unique').on(t.name)]
)

/**
 * Agents connectés à un nœud de la carte, avant le lancement (docs/TACHES-AGENTS.md T006, migration 0052) : un croquis
 * par nœud. Les agents et leurs liens sont du JSON validé à la lecture. Depuis la migration 0054 (L1o D14), le nœud est
 * une tâche ou un document de la vue Workflow (clé `wf:…`, lue dans les fichiers du projet) : plus de clé étrangère
 * vers `neurons` ; un croquis dont le nœud a disparu n'est plus dessiné.
 */
export const assemblySketches = sqliteTable(
  'assembly_sketches',
  {
    nodeId: text('node_id').primaryKey(),
    genesisId: text('genesis_id').notNull(),
    taskId: text('task_id').notNull(),
    task: text('task'),
    /** Agents du croquis (JSON : AssemblyAgent[]). */
    agents: text('agents').notNull().default('[]'),
    /** Liens « B attend A » (JSON : AssemblyLink[]). */
    links: text('links').notNull().default('[]'),
    /** Équipe d'un lot (L1o D25) : plan du PO et aiguillages retouchés à la main (JSON : SketchLot) ; `null` sinon. */
    lot: text('lot'),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [index('assembly_sketches_genesis_idx').on(t.genesisId)]
)

/**
 * Agents posés libres sur la carte d'un projet (L1o D26, migration 0056) : appelés depuis le tiroir, pas encore reliés
 * à un nœud. Un lien vers une tâche les y connecte et les retire d'ici.
 */
export const agentBench = sqliteTable(
  'agent_bench',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id').notNull(),
    profileId: text('profile_id')
      .notNull()
      .references(() => agentProfiles.id, { onDelete: 'cascade' }),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [index('agent_bench_genesis_idx').on(t.genesisId)]
)
