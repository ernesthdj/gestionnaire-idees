import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)

/** Journal des appels IA — aucun contenu d'idée ni de réponse (spec 001 FR-007). */
export const aiCalls = sqliteTable(
  'ai_calls',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id').notNull(),
    kind: text('kind').notNull(),
    engine: text('engine', { enum: ['ollama', 'claude'] }).notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    costMillicents: integer('cost_millicents').notNull().default(0),
    status: text('status', { enum: ['ok', 'invalid', 'error', 'refusal', 'blocked_budget'] }).notNull(),
    errorCode: text('error_code'),
    durationMs: integer('duration_ms').notNull().default(0),
    createdAt: createdAt()
  },
  (t) => [
    index('ai_calls_created_at_idx').on(t.createdAt),
    index('ai_calls_engine_created_at_idx').on(t.engine, t.createdAt)
  ]
)

/** Configuration IA clé/valeur (valeurs JSON validées par Zod à la lecture). */
export const aiConfig = sqliteTable('ai_config', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull()
})

export const contextImports = sqliteTable(
  'context_imports',
  {
    id: text('id').primaryKey(),
    detectedAt: text('detected_at').notNull(),
    manifestJson: text('manifest_json').notNull(),
    diffJson: text('diff_json'),
    status: text('status', { enum: ['pending', 'applied', 'rejected', 'invalid'] }).notNull(),
    error: text('error')
  },
  (t) => [index('context_imports_status_idx').on(t.status)]
)

export const contextVersions = sqliteTable(
  'context_versions',
  {
    id: text('id').primaryKey(),
    version: integer('version').notNull(),
    profileMd: text('profile_md').notNull().default(''),
    rulesMd: text('rules_md').notNull().default(''),
    source: text('source', { enum: ['seed', 'import'] }).notNull(),
    importId: text('import_id').references(() => contextImports.id),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    appliedAt: text('applied_at').notNull()
  },
  // Une seule version active à la fois.
  (t) => [
    uniqueIndex('context_versions_single_active_idx')
      .on(t.isActive)
      .where(sql`${t.isActive} = 1`)
  ]
)

export const examples = sqliteTable(
  'examples',
  {
    id: text('id').primaryKey(),
    polarity: text('polarity', { enum: ['positive', 'negative'] }).notNull(),
    taskKind: text('task_kind').notNull(),
    contentJson: text('content_json').notNull(),
    source: text('source', { enum: ['accepted_proposal', 'rejected_proposal', 'import'] }).notNull(),
    createdAt: createdAt()
  },
  (t) => [index('examples_task_kind_idx').on(t.taskKind)]
)

/** File locale persistante des demandes en attente d'Ollama (analyse C1). */
export const aiPendingRequests = sqliteTable(
  'ai_pending_requests',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id').notNull().unique(),
    kind: text('kind').notNull(),
    payload: text('payload').notNull(),
    attempts: integer('attempts').notNull().default(0),
    createdAt: createdAt()
  },
  (t) => [index('ai_pending_requests_created_at_idx').on(t.createdAt)]
)
