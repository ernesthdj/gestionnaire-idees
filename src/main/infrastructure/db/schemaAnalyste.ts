import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Analyste interne (spec 019 data-model) : observations de la sonde (sans contenu), analyses, propositions et mises à
 * jour. Dates en millisecondes depuis l'époque (purge et fenêtres par comparaison d'entiers).
 */

export const observations = sqliteTable(
  'observations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: integer('at').notNull(),
    family: text('family', { enum: ['navigation', 'action', 'erreur', 'performance'] }).notNull(),
    event: text('event').notNull(),
    screen: text('screen'),
    subjectKind: text('subject_kind'),
    /** Pseudonyme HMAC (12 hexadécimaux) : jamais l'identifiant de l'objet. */
    subjectRef: text('subject_ref'),
    via: text('via'),
    channel: text('channel'),
    code: text('code'),
    module: text('module'),
    /** JSON : au plus 5 emplacements « chemin/relatif:ligne » du dépôt. */
    frames: text('frames'),
    durationMs: integer('duration_ms'),
    status: text('status'),
    count: integer('count').notNull().default(1)
  },
  (t) => [
    index('observations_at_idx').on(t.at),
    index('observations_family_at_idx').on(t.family, t.at),
    index('observations_event_at_idx').on(t.event, t.at)
  ]
)

export const analyses = sqliteTable(
  'analyses',
  {
    id: text('id').primaryKey(),
    trigger: text('trigger', { enum: ['manual', 'auto'] }).notNull(),
    status: text('status', { enum: ['running', 'done', 'failed', 'cancelled'] }).notNull(),
    windowFrom: integer('window_from').notNull(),
    windowTo: integer('window_to').notNull(),
    events: integer('events').notNull().default(0),
    proposals: integer('proposals').notNull().default(0),
    aiCallId: text('ai_call_id'),
    errorCode: text('error_code'),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at')
  },
  (t) => [
    index('analyses_started_at_idx').on(t.startedAt),
    // Une seule analyse en cours à la fois (FR-020).
    uniqueIndex('analyses_one_running_idx')
      .on(t.status)
      .where(sql`status = 'running'`)
  ]
)

export const proposals = sqliteTable(
  'proposals',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id')
      .notNull()
      .references(() => analyses.id),
    category: text('category', { enum: ['bug', 'ia_vers_code', 'parcours', 'code_mort', 'evolutivite'] }).notNull(),
    title: text('title').notNull(),
    finding: text('finding').notNull(),
    proposal: text('proposal').notNull(),
    gain: text('gain').notNull(),
    risk: text('risk', { enum: ['faible', 'moyen', 'eleve'] }).notNull(),
    severity: integer('severity').notNull(),
    confidence: real('confidence').notNull(),
    /** JSON : `{ observations: { key, sentence }[], code: { path, start?, end? }[] }`. */
    evidence: text('evidence').notNull(),
    /** JSON : chemins relatifs vérifiés dans le dépôt. */
    files: text('files').notNull(),
    withoutEvidence: integer('without_evidence', { mode: 'boolean' }).notNull().default(false),
    dedupeKey: text('dedupe_key').notNull(),
    status: text('status', {
      enum: [
        'new',
        'postponed',
        'refused',
        'accepted',
        'coding',
        'to_fix',
        'ready',
        'kept',
        'discarded',
        'reverted',
        'applied'
      ]
    })
      .notNull()
      .default('new'),
    refusalReason: text('refusal_reason'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [
    index('proposals_status_created_idx').on(t.status, t.createdAt),
    index('proposals_dedupe_idx').on(t.dedupeKey)
  ]
)

export const analystUpdates = sqliteTable(
  'analyst_updates',
  {
    id: text('id').primaryKey(),
    proposalId: text('proposal_id')
      .notNull()
      .references(() => proposals.id),
    branch: text('branch').notNull(),
    worktreePath: text('worktree_path').notNull(),
    baseSha: text('base_sha').notNull(),
    /** Branche de base où « Garder » fusionne (migration 0036). */
    baseBranch: text('base_branch'),
    headSha: text('head_sha'),
    mergeSha: text('merge_sha'),
    revertSha: text('revert_sha'),
    status: text('status', {
      enum: ['coding', 'to_fix', 'ready', 'keeping', 'kept', 'discarded', 'reverted', 'failed']
    }).notNull(),
    /** JSON : `{ typecheck, lint, prettier, test }` (pending / ok / fail) et la fin de sortie d'un échec. */
    checks: text('checks').notNull(),
    depsChanged: integer('deps_changed', { mode: 'boolean' }).notNull().default(false),
    conversationNeuronId: text('conversation_neuron_id'),
    discardReason: text('discard_reason'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [
    uniqueIndex('analyst_updates_proposal_idx').on(t.proposalId),
    uniqueIndex('analyst_updates_branch_idx').on(t.branch),
    index('analyst_updates_status_idx').on(t.status)
  ]
)
