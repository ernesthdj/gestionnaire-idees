import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

/** Modèle central du Brainstormer (spec 002 data-model v2). */

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull()
})

/** Racines (idées) et sous-neurones dans une seule table (research R9). */
export const neurons = sqliteTable(
  'neurons',
  {
    id: text('id').primaryKey(),
    rootId: text('root_id').notNull(),
    parentId: text('parent_id').references((): AnySQLiteColumn => neurons.id),
    depth: integer('depth').notNull().default(0),
    kind: text('kind', {
      enum: ['root', 'answer', 'condition', 'branch', 'opportunity', 'investigation', 'user_branch', 'idea']
    }).notNull(),
    title: text('title').notNull(),
    content: text('content'),
    amountCents: integer('amount_cents'),
    dueDate: text('due_date'),
    origin: text('origin', { enum: ['ai', 'user'] }).notNull(),
    /** Extension à laquelle ce sous-neurone répond : unique, donc une réponse rejouée ne crée rien. */
    fromExtensionId: text('from_extension_id').unique(),
    nature: text('nature', { enum: ['action', 'reflection'] }),
    natureSource: text('nature_source', { enum: ['ai', 'user'] }),
    categoryId: text('category_id').references(() => categories.id),
    categorySource: text('category_source', { enum: ['ai', 'user'] }),
    state: text('state', { enum: ['raw', 'developing', 'hatched', 'archived'] }),
    version: integer('version').notNull().default(0),
    posX: real('pos_x'),
    posY: real('pos_y'),
    /** Glissé à la main sur la carte : la physique le garde à sa place (les autres s'écartent). */
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    /**
     * Synthèse qui a absorbé ce sous-neurone à l'éclosion (spec 003 T064) : il disparaît de la carte et des
     * questions, mais reste en données (source du document, cycles suivants).
     */
    absorbedIn: text('absorbed_in'),
    /**
     * Idée de départ : résumé de l'idée par l'IA (fiche au clic) et version de l'idée pour laquelle il a été
     * calculé — recalculé seulement quand l'idée a changé.
     */
    summary: text('summary'),
    summaryVersion: integer('summary_version'),
    createdAt: createdAt(),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    archivedAt: text('archived_at')
  },
  (t) => [
    index('neurons_root_idx').on(t.rootId),
    index('neurons_parent_idx').on(t.parentId),
    index('neurons_state_idx').on(t.state),
    index('neurons_nature_idx').on(t.nature),
    index('neurons_category_idx').on(t.categoryId)
  ]
)

export const extensions = sqliteTable(
  'extensions',
  {
    id: text('id').primaryKey(),
    rootId: text('root_id').notNull(),
    neuronId: text('neuron_id')
      .notNull()
      .references(() => neurons.id),
    question: text('question').notNull(),
    quickRepliesJson: text('quick_replies_json').notNull().default('[]'),
    dimension: text('dimension').notNull(),
    answerKind: text('answer_kind', { enum: ['answer', 'condition', 'opportunity'] }),
    status: text('status', { enum: ['proposed', 'answered', 'dismissed'] }).notNull(),
    origin: text('origin', { enum: ['ai', 'user'] }).notNull(),
    createdAt: createdAt(),
    resolvedAt: text('resolved_at')
  },
  (t) => [index('extensions_root_status_idx').on(t.rootId, t.status)]
)

/**
 * Suggestions d'approfondissement (neurones fantômes) : proposées par l'IA, acceptées ou ignorées par l'utilisateur.
 * `research` suit la vérification web éventuelle ; `sources_json` garde les pages citées (URL + titre).
 */
export const suggestions = sqliteTable(
  'suggestions',
  {
    id: text('id').primaryKey(),
    rootId: text('root_id').notNull(),
    neuronId: text('neuron_id')
      .notNull()
      .references(() => neurons.id),
    title: text('title').notNull(),
    content: text('content').notNull(),
    webQuery: text('web_query'),
    research: text('research', { enum: ['none', 'available', 'pending', 'done', 'failed'] }).notNull(),
    sourcesJson: text('sources_json').notNull().default('[]'),
    status: text('status', { enum: ['proposed', 'accepted', 'dismissed'] }).notNull(),
    acceptedNeuronId: text('accepted_neuron_id'),
    createdAt: createdAt(),
    resolvedAt: text('resolved_at')
  },
  (t) => [index('suggestions_root_status_idx').on(t.rootId, t.status)]
)

export const contextAssessments = sqliteTable(
  'context_assessments',
  {
    id: text('id').primaryKey(),
    rootId: text('root_id').notNull(),
    level: text('level', { enum: ['insufficient', 'sufficient', 'complete'] }).notNull(),
    aiLevel: text('ai_level', { enum: ['insufficient', 'sufficient', 'complete'] }).notNull(),
    coveredJson: text('covered_json').notNull(),
    missingJson: text('missing_json').notNull(),
    answeredCount: integer('answered_count').notNull(),
    createdAt: createdAt()
  },
  (t) => [index('context_assessments_root_idx').on(t.rootId)]
)

export const syntheses = sqliteTable(
  'syntheses',
  {
    id: text('id').primaryKey(),
    rootId: text('root_id').notNull(),
    type: text('type', { enum: ['action_plan', 'reflection_summary'] }).notNull(),
    payloadJson: text('payload_json').notNull(),
    baseVersion: integer('base_version').notNull(),
    instruction: text('instruction'),
    forced: integer('forced', { mode: 'boolean' }).notNull().default(false),
    degraded: integer('degraded', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: ['proposed', 'confirmed', 'rejected', 'superseded', 'stale'] }).notNull(),
    batchId: text('batch_id'),
    createdAt: createdAt(),
    decidedAt: text('decided_at')
  },
  (t) => [index('syntheses_root_status_idx').on(t.rootId, t.status)]
)

export const planNodes = sqliteTable(
  'plan_nodes',
  {
    id: text('id').primaryKey(),
    rootId: text('root_id').notNull(),
    synthesisId: text('synthesis_id').notNull(),
    parentId: text('parent_id'),
    type: text('type', { enum: ['task', 'condition', 'opportunity'] }).notNull(),
    title: text('title').notNull(),
    question: text('question'),
    branchLabel: text('branch_label'),
    activeBranch: integer('active_branch', { mode: 'boolean' }).notNull().default(true),
    amountCents: integer('amount_cents'),
    dueDate: text('due_date'),
    status: text('status', { enum: ['blocked', 'ready', 'in_progress', 'done', 'abandoned'] }).notNull(),
    investigation: integer('investigation', { mode: 'boolean' }).notNull().default(false),
    toSchedule: integer('to_schedule', { mode: 'boolean' }).notNull().default(false),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(true),
    posX: real('pos_x'),
    posY: real('pos_y')
  },
  (t) => [index('plan_nodes_root_idx').on(t.rootId)]
)

export const planDependencies = sqliteTable(
  'plan_dependencies',
  {
    id: text('id').primaryKey(),
    fromNodeId: text('from_node_id')
      .notNull()
      .references(() => planNodes.id),
    toNodeId: text('to_node_id')
      .notNull()
      .references(() => planNodes.id),
    kind: text('kind', { enum: ['after_done', 'on_trigger'] }).notNull(),
    triggerLabel: text('trigger_label'),
    triggerReachedAt: text('trigger_reached_at')
  },
  (t) => [uniqueIndex('plan_dependencies_pair_idx').on(t.fromNodeId, t.toNodeId)]
)

export const reflectionSummaries = sqliteTable(
  'reflection_summaries',
  {
    id: text('id').primaryKey(),
    rootId: text('root_id').notNull(),
    synthesisId: text('synthesis_id').notNull(),
    keyPointsJson: text('key_points_json').notNull(),
    decisionsJson: text('decisions_json').notNull(),
    prosJson: text('pros_json').notNull(),
    consJson: text('cons_json').notNull(),
    openQuestionsJson: text('open_questions_json').notNull(),
    /** Fiche éditoriale : « En bref » et prochaine étape conseillée (absents des synthèses plus anciennes). */
    overview: text('overview'),
    nextStep: text('next_step'),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(true)
  },
  (t) => [index('reflection_summaries_root_idx').on(t.rootId)]
)

export const neuronLinks = sqliteTable(
  'neuron_links',
  {
    id: text('id').primaryKey(),
    /** Paire ordonnée (a < b) : un lien n'existe qu'une fois quel que soit le sens. */
    aRootId: text('a_root_id').notNull(),
    bRootId: text('b_root_id').notNull(),
    label: text('label').notNull(),
    justification: text('justification'),
    origin: text('origin', { enum: ['ai', 'user'] }).notNull(),
    status: text('status', { enum: ['suggested', 'accepted', 'rejected', 'superseded'] }).notNull(),
    fingerprint: text('fingerprint').notNull(),
    createdAt: createdAt(),
    decidedAt: text('decided_at')
  },
  (t) => [index('neuron_links_status_idx').on(t.status), index('neuron_links_fingerprint_idx').on(t.fingerprint)]
)

/**
 * Graine d'idée portée par un lien (spec 003 FR-028) : une seule par lien, jamais reproposée une fois refusée.
 * Acceptée, elle devient une idée brute (`bornRootId`) « née de A × B ».
 */
export const linkSeeds = sqliteTable('link_seeds', {
  id: text('id').primaryKey(),
  linkId: text('link_id')
    .notNull()
    .unique()
    .references(() => neuronLinks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  why: text('why').notNull(),
  status: text('status', { enum: ['suggested', 'accepted', 'rejected'] }).notNull(),
  bornRootId: text('born_root_id').references(() => neurons.id),
  createdAt: createdAt(),
  decidedAt: text('decided_at')
})

/** Historique append-only, groupé par lot (annulation, spec 003). */
export const changeLog = sqliteTable(
  'change_log',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id').notNull(),
    kind: text('kind', {
      enum: ['confirm_synthesis', 'manual_edit', 'link', 'seed', 'delete', 'promote', 'undo']
    }).notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    createdAt: createdAt(),
    undoneByBatch: text('undone_by_batch')
  },
  (t) => [index('change_log_batch_idx').on(t.batchId)]
)

/**
 * Blocs libres de l'écran Idées (spec 003 FR-026) : conteneurs vides placés par l'utilisateur, supports des
 * mini-widgets de la v2. Aucun contenu ni code en MVP-1 : seulement position et taille.
 */
export const canvasBlocks = sqliteTable('canvas_blocks', {
  id: text('id').primaryKey(),
  /** Bloc vide (003), note (étiquette de texte) ou widget généré par Claude (spec 004). */
  kind: text('kind', { enum: ['empty', 'label', 'widget'] })
    .notNull()
    .default('empty'),
  x: real('x').notNull(),
  y: real('y').notNull(),
  width: real('width').notNull(),
  height: real('height').notNull(),
  /** Texte d'une note. */
  text: text('text'),
  /** Version affichée d'un widget (restaurer une version = changer ce pointeur). */
  currentVersionId: text('current_version_id'),
  /** Suppression annulable : le bloc (et les versions d'un widget) reste en base jusqu'à la purge. */
  deletedAt: text('deleted_at'),
  createdAt: createdAt()
})

/** Versions d'un widget (spec 004) : chaque génération par Claude en crée une ; le code n'est jamais modifié. */
export const widgetVersions = sqliteTable(
  'widget_versions',
  {
    id: text('id').primaryKey(),
    blockId: text('block_id')
      .notNull()
      .references(() => canvasBlocks.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    html: text('html').notNull(),
    css: text('css').notNull(),
    ts: text('ts').notNull(),
    /** JavaScript issu du TypeScript (types retirés localement) : seul code exécuté. */
    js: text('js').notNull(),
    summary: text('summary').notNull(),
    model: text('model').notNull(),
    createdAt: createdAt()
  },
  (t) => [index('widget_versions_block_idx').on(t.blockId)]
)

/** Conversation d'un widget : demandes de l'utilisateur et réponses de Claude (résumé de ce qui a changé). */
export const widgetMessages = sqliteTable(
  'widget_messages',
  {
    id: text('id').primaryKey(),
    blockId: text('block_id')
      .notNull()
      .references(() => canvasBlocks.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    text: text('text').notNull(),
    versionId: text('version_id'),
    /** Réponse en échec (message d'erreur affiché, aucune version créée). */
    failed: integer('failed', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt()
  },
  (t) => [index('widget_messages_block_idx').on(t.blockId)]
)

/** Réglages génériques clé/valeur (JSON validé à la lecture). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull()
})
