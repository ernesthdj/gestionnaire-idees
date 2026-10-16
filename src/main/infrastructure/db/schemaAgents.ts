import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [uniqueIndex('agent_profiles_name_unique').on(t.name)]
)
