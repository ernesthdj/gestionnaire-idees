import { sql } from 'drizzle-orm'
import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Brainstorms (spec 024 data-model, migration 0040) : un projet travaillé dans l'app, avec son canevas. Les genesis et
 * les blocs y sont rattachés par `brainstorm_id` ; l'état de vue (position, vues, cartes ouvertes) est relu à
 * l'ouverture. Points de sauvegarde : instantanés gzip du canevas (US2).
 */

const now = (name: string) =>
  text(name)
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)

export const brainstorms = sqliteTable(
  'brainstorms',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    type: text('type'),
    /** `vault` : dossier sous `projects/` du coffre ; `external` : ailleurs (D9) ; `local` : sans dossier (Idées en vrac). */
    location: text('location', { enum: ['vault', 'external', 'local'] }).notNull(),
    origin: text('origin', { enum: ['scratch', 'existing', 'clone', 'migrated'] }).notNull(),
    /** Chemin réel du dossier ; nul pour un brainstorm local. */
    folderPath: text('folder_path'),
    gitRole: text('git_role', { enum: ['owner', 'collaborator', 'none'] })
      .notNull()
      .default('none'),
    workBranch: text('work_branch'),
    github: integer('github', { mode: 'boolean' }).notNull().default(false),
    viewStateJson: text('view_state_json'),
    createdAt: now('created_at'),
    lastOpenedAt: text('last_opened_at'),
    archivedAt: text('archived_at')
  },
  (t) => [uniqueIndex('brainstorms_slug_idx').on(t.slug), uniqueIndex('brainstorms_folder_idx').on(t.folderPath)]
)

export const savePoints = sqliteTable(
  'save_points',
  {
    id: text('id').primaryKey(),
    brainstormId: text('brainstorm_id')
      .notNull()
      .references(() => brainstorms.id),
    name: text('name').notNull(),
    /** Point automatique « avant retour à … » (R3), absent de la liste. */
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    snapshot: blob('snapshot', { mode: 'buffer' }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: now('created_at')
  },
  (t) => [index('save_points_brainstorm_idx').on(t.brainstormId)]
)
