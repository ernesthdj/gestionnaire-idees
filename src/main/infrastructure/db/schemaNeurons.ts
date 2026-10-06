import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core'

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
      enum: [
        'root',
        'answer',
        'condition',
        'branch',
        'opportunity',
        'investigation',
        'user_branch',
        'idea',
        'element',
        'step'
      ]
    }).notNull(),
    title: text('title').notNull(),
    content: text('content'),
    amountCents: integer('amount_cents'),
    dueDate: text('due_date'),
    origin: text('origin', { enum: ['ai', 'user', 'claude'] }).notNull(),
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
    /** Conversation Claude Code du neurone (spec 008) : session reprise à chaque ouverture. */
    sessionId: text('session_id').unique(),
    /** Vrai après le premier tour réussi : on reprend la session au lieu de la créer. */
    sessionStarted: integer('session_started', { mode: 'boolean' }).notNull().default(false),
    /** Fiche tenue par Claude : résumé, points clés, décisions, questions ouvertes, manques (JSON). */
    sheetJson: text('sheet_json'),
    /** Dossier de projet lié (spec 008) : la conversation du neurone s'y ouvre et lit ses fichiers. */
    projectDir: text('project_dir'),
    /** Modèle choisi pour la conversation de ce neurone (spec 010) ; `null` : le modèle par défaut de son usage. */
    chatModel: text('chat_model'),
    /**
     * Élément de la carte de structure d'un projet (spec 009) : genesis auquel il appartient, type, clé stable dans le
     * projet, statut, chemins des fichiers (JSON), repli de ses enfants sur la carte.
     */
    genesisId: text('genesis_id'),
    elementType: text('element_type', {
      enum: ['module', 'fonctionnalite', 'composant', 'donnee', 'interface', 'tache', 'decision', 'operation']
    }),
    elementKey: text('element_key'),
    elementStatus: text('element_status'),
    pathsJson: text('paths_json'),
    collapsed: integer('collapsed', { mode: 'boolean' }).notNull().default(true),
    /** Étape d'un plan d'attaque (spec 011) : rang parmi ses sœurs (①②③) et statut d'avancement. */
    rank: integer('rank'),
    stepStatus: text('step_status', { enum: ['a_faire', 'en_cours', 'fait', 'bloque'] }),
    /** Verrou (spec 011) : fiche, titre et description figés ; ses sous-nœuds s'appuient sur ce contexte. */
    lockedAt: text('locked_at'),
    /** Verrou proposé par Claude, en attente de la décision de mentalyas. */
    lockProposedAt: text('lock_proposed_at'),
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
    index('neurons_category_idx').on(t.categoryId),
    uniqueIndex('neurons_element_key_idx').on(t.genesisId, t.elementKey),
    index('neurons_genesis_idx').on(t.genesisId),
    index('neurons_parent_rank_idx').on(t.parentId, t.rank)
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

/** Messages affichés de la conversation d'un neurone (spec 008) ; le CLI garde sa propre transcription. */
export const neuronMessages = sqliteTable(
  'neuron_messages',
  {
    id: text('id').primaryKey(),
    neuronId: text('neuron_id')
      .notNull()
      .references(() => neurons.id),
    role: text('role', { enum: ['user', 'assistant', 'tool', 'error'] }).notNull(),
    text: text('text').notNull(),
    createdAt: createdAt()
  },
  (t) => [index('neuron_messages_neuron_idx').on(t.neuronId)]
)

/** Historique append-only, groupé par lot (annulation, spec 003). */
export const changeLog = sqliteTable(
  'change_log',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id').notNull(),
    kind: text('kind', {
      enum: [
        'confirm_synthesis',
        'manual_edit',
        'link',
        'seed',
        'delete',
        'promote',
        'undo',
        'mcp_write',
        'convert',
        'plan',
        'document',
        'final'
      ]
    }).notNull(),
    /** Auteur du lot : mentalyas, ou Claude Code par le pont MCP (spec 007 FR-013). */
    actor: text('actor', { enum: ['user', 'claude'] })
      .notNull()
      .default('user'),
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
export const canvasBlocks = sqliteTable(
  'canvas_blocks',
  {
    id: text('id').primaryKey(),
    /**
     * Bloc vide (003), note (étiquette de texte), widget généré par Claude (spec 004), cadre résultat (spec 005),
     * note titrée et cadre de regroupement (spec 007).
     */
    kind: text('kind', { enum: ['empty', 'label', 'widget', 'result', 'note', 'frame'] })
      .notNull()
      .default('empty'),
    x: real('x').notNull(),
    y: real('y').notNull(),
    width: real('width').notNull(),
    height: real('height').notNull(),
    /** Texte d'une note. */
    text: text('text'),
    /** Titre d'une note titrée ou d'un cadre (spec 007). */
    title: text('title'),
    /** Note parente (arbre de notes dessiné par Claude). */
    parentBlockId: text('parent_block_id').references((): AnySQLiteColumn => canvasBlocks.id),
    /** Cadre qui regroupe ce bloc. */
    frameId: text('frame_id').references((): AnySQLiteColumn => canvasBlocks.id),
    /** Posé par mentalyas ou par Claude Code (pont MCP). */
    origin: text('origin', { enum: ['user', 'claude'] })
      .notNull()
      .default('user'),
    /** Version affichée d'un widget (restaurer une version = changer ce pointeur). */
    currentVersionId: text('current_version_id'),
    /** Cadre résultat (spec 005) : widget dont il affiche le résultat. */
    sourceBlockId: text('source_block_id'),
    /** Suppression annulable : le bloc (et les versions d'un widget) reste en base jusqu'à la purge. */
    deletedAt: text('deleted_at'),
    createdAt: createdAt()
  },
  (t) => [index('canvas_blocks_parent_idx').on(t.parentBlockId), index('canvas_blocks_frame_idx').on(t.frameId)]
)

/**
 * Liens libres de la carte (spec 007) : entre blocs et idées, libellés, sans statut ni empreinte ; retrait annulable.
 * Les liens suggérés entre idées restent dans `neuron_links`.
 */
export const mapLinks = sqliteTable(
  'map_links',
  {
    id: text('id').primaryKey(),
    fromKind: text('from_kind', { enum: ['block', 'idea', 'element'] }).notNull(),
    fromId: text('from_id').notNull(),
    toKind: text('to_kind', { enum: ['block', 'idea', 'element'] }).notNull(),
    toId: text('to_id').notNull(),
    label: text('label'),
    /** Relation typée d'une carte de structure (spec 009) : depend_de, appelle, lit_ecrit, implemente, teste, bloque. */
    relation: text('relation'),
    origin: text('origin', { enum: ['user', 'claude'] }).notNull(),
    createdAt: createdAt(),
    deletedAt: text('deleted_at')
  },
  (t) => [index('map_links_from_idx').on(t.fromKind, t.fromId), index('map_links_to_idx').on(t.toKind, t.toId)]
)

/**
 * Branchements d'entrée des widgets (spec 005) : une idée ou une prochaine étape reliée à un widget, avec les
 * parties de l'idée transmises. Débranchement annulable (`deleted_at`).
 */
export const widgetInputs = sqliteTable(
  'widget_inputs',
  {
    id: text('id').primaryKey(),
    blockId: text('block_id')
      .notNull()
      .references(() => canvasBlocks.id, { onDelete: 'cascade' }),
    sourceKind: text('source_kind', { enum: ['idea', 'plan_step', 'step'] }).notNull(),
    /** Idée, étape de plan (spec 015), ou idée dont l'ancienne prochaine étape est branchée. */
    sourceId: text('source_id').notNull(),
    partsJson: text('parts_json').notNull().default('[]'),
    deletedAt: text('deleted_at'),
    createdAt: createdAt()
  },
  (t) => [index('widget_inputs_block_idx').on(t.blockId)]
)

/**
 * Autorisations (spec 005 FR-002) : empreinte du code d'une version et de ce qu'elle lit, approuvée par
 * l'utilisateur après revue. Sans ligne correspondante, le widget ne reçoit rien.
 */
export const widgetApprovals = sqliteTable(
  'widget_approvals',
  {
    blockId: text('block_id')
      .notNull()
      .references(() => canvasBlocks.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),
    approvedAt: createdAt()
  },
  (t) => [primaryKey({ columns: [t.blockId, t.fingerprint] })]
)

/** Dernier résultat émis par un widget (spec 005 FR-006) : JSON borné, affiché par son cadre résultat. */
export const widgetResults = sqliteTable('widget_results', {
  blockId: text('block_id')
    .primaryKey()
    .references(() => canvasBlocks.id, { onDelete: 'cascade' }),
  dataJson: text('data_json').notNull(),
  updatedAt: text('updated_at').notNull()
})

/**
 * Outil proposé à l'éclosion et coché (spec 006) : la demande reste attachée à son widget tant qu'il n'a aucune
 * version, pour que « Réessayer » relance la même génération (après un échec ou un redémarrage).
 */
export const widgetRequests = sqliteTable('widget_requests', {
  blockId: text('block_id')
    .primaryKey()
    .references(() => canvasBlocks.id, { onDelete: 'cascade' }),
  rootId: text('root_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  producesResult: integer('produces_result', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt()
})

/**
 * Place de la « prochaine étape » d'une idée sur la carte, quand elle a été glissée à la main (épinglée). L'étape
 * elle-même n'est pas stockée : elle se lit dans le document en cours de l'idée.
 */
export const ideaSteps = sqliteTable('idea_steps', {
  rootId: text('root_id')
    .primaryKey()
    .references(() => neurons.id, { onDelete: 'cascade' }),
  x: real('x').notNull(),
  y: real('y').notNull()
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

/**
 * Document Markdown rattaché à un neurone (spec 012) : son contenu vit dans un vrai fichier `.md` (dossier du projet
 * lié au genesis, sinon du profil), choisi par l'app ; la base garde ses versions (annulation, recréation).
 */
export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),
    neuronId: text('neuron_id')
      .notNull()
      .references(() => neurons.id),
    genesisId: text('genesis_id')
      .notNull()
      .references(() => neurons.id),
    title: text('title').notNull(),
    folder: text('folder', { enum: ['project', 'profile'] }).notNull(),
    fileName: text('file_name').notNull(),
    width: real('width').notNull(),
    height: real('height').notNull(),
    origin: text('origin', { enum: ['user', 'claude'] }).notNull(),
    currentVersionId: text('current_version_id'),
    /** Décalage manuel (glissé par mentalyas) par rapport à sa place d'annexe sous son neurone. */
    offsetX: real('offset_x').notNull().default(0),
    offsetY: real('offset_y').notNull().default(0),
    createdAt: createdAt(),
    deletedAt: text('deleted_at')
  },
  (t) => [index('documents_neuron_idx').on(t.neuronId), index('documents_genesis_idx').on(t.genesisId)]
)

/** Version complète d'un document : écrite par mentalyas, par Claude, ou constatée sur le disque (`externe`). */
export const documentVersions = sqliteTable(
  'document_versions',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id),
    content: text('content').notNull(),
    hash: text('hash').notNull(),
    author: text('author', { enum: ['user', 'claude', 'externe'] }).notNull(),
    createdAt: createdAt()
  },
  (t) => [index('document_versions_document_idx').on(t.documentId)]
)

/** Dépendance entre deux étapes sœurs d'un plan d'attaque (spec 011) : `stepId` attend `waitsForId`. */
export const stepDependencies = sqliteTable(
  'step_dependencies',
  {
    stepId: text('step_id')
      .notNull()
      .references(() => neurons.id),
    waitsForId: text('waits_for_id')
      .notNull()
      .references(() => neurons.id)
  },
  (t) => [primaryKey({ columns: [t.stepId, t.waitsForId] }), index('step_dependencies_waits_idx').on(t.waitsForId)]
)

/**
 * Couche d'étapes proposée par Claude pour un nœud (spec 011) : rien n'est écrit dans les nœuds de mentalyas avant
 * sa décision. Une seule proposition `en_attente` par parent.
 */
export const planProposals = sqliteTable(
  'plan_proposals',
  {
    id: text('id').primaryKey(),
    parentId: text('parent_id')
      .notNull()
      .references(() => neurons.id),
    status: text('status', { enum: ['en_attente', 'decidee', 'remplacee'] }).notNull(),
    createdAt: createdAt()
  },
  (t) => [index('plan_proposals_parent_idx').on(t.parentId, t.status)]
)

/** Étape proposée (fantôme) ; un item refusé sert de mémoire pour ne pas reproposer le même titre au même parent. */
export const planProposalItems = sqliteTable(
  'plan_proposal_items',
  {
    id: text('id').primaryKey(),
    proposalId: text('proposal_id')
      .notNull()
      .references(() => planProposals.id),
    key: text('key').notNull(),
    title: text('title').notNull(),
    why: text('why').notNull(),
    rank: integer('rank').notNull(),
    waitsForJson: text('waits_for_json').notNull().default('[]'),
    status: text('status', { enum: ['en_attente', 'valide', 'refuse'] }).notNull(),
    bornId: text('born_id')
  },
  (t) => [index('plan_proposal_items_proposal_idx').on(t.proposalId)]
)

/**
 * Étape proposée ou devenue action finale (spec 013) : feuille de son plan, exécutable par Claude dans le dossier du
 * projet lié. « Fait » se lit dans `neurons.step_status`. Le livrable est son annexe (place et taille gardées).
 */
export const finalActions = sqliteTable(
  'final_actions',
  {
    neuronId: text('neuron_id')
      .primaryKey()
      .references(() => neurons.id),
    genesisId: text('genesis_id')
      .notNull()
      .references(() => neurons.id),
    deliverable: text('deliverable').notNull(),
    reason: text('reason').notNull(),
    state: text('state', { enum: ['proposee', 'prete', 'en_cours', 'a_revoir'] }).notNull(),
    origin: text('origin', { enum: ['user', 'claude'] }).notNull(),
    proposedAt: text('proposed_at').notNull(),
    acceptedAt: text('accepted_at'),
    archivedAt: text('archived_at'),
    offsetX: real('offset_x').notNull().default(0),
    offsetY: real('offset_y').notNull().default(0),
    width: real('width').notNull().default(420),
    height: real('height').notNull().default(300)
  },
  (t) => [index('final_actions_genesis_idx').on(t.genesisId)]
)

/** Une passe de Claude sur une action finale ; au plus une exécution ouverte (`ended_at` nul) par genesis. */
export const executions = sqliteTable(
  'executions',
  {
    id: text('id').primaryKey(),
    neuronId: text('neuron_id')
      .notNull()
      .references(() => finalActions.neuronId),
    genesisId: text('genesis_id').notNull(),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    outcome: text('outcome', { enum: ['terminee', 'arretee', 'interrompue', 'echouee'] }),
    correction: text('correction'),
    filesWritten: integer('files_written').notNull().default(0)
  },
  (t) => [
    index('executions_neuron_idx').on(t.neuronId),
    uniqueIndex('executions_open_genesis_idx')
      .on(t.genesisId)
      .where(sql`ended_at IS NULL`)
  ]
)

/** Fil d'une exécution (trace, spec 013 FR-007) : chemins relatifs et motifs, jamais de contenu de fichier. */
export const executionEvents = sqliteTable(
  'execution_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    executionId: text('execution_id')
      .notNull()
      .references(() => executions.id),
    at: text('at').notNull(),
    kind: text('kind', { enum: ['lecture', 'ecriture', 'refus', 'message', 'commande'] }).notNull(),
    path: text('path'),
    detail: text('detail')
  },
  (t) => [index('execution_events_execution_idx').on(t.executionId)]
)

/** Fichier du livrable cumulé d'une action : contenu d'avant la première écriture (`null` = créé) et dernier écrit. */
export const deliverableFiles = sqliteTable(
  'deliverable_files',
  {
    id: text('id').primaryKey(),
    neuronId: text('neuron_id')
      .notNull()
      .references(() => finalActions.neuronId),
    path: text('path').notNull(),
    pathKey: text('path_key').notNull(),
    beforeContent: text('before_content'),
    afterContent: text('after_content').notNull(),
    afterHash: text('after_hash').notNull(),
    updatedAt: text('updated_at').notNull(),
    revertedAt: text('reverted_at')
  },
  (t) => [uniqueIndex('deliverable_files_path_idx').on(t.neuronId, t.pathKey)]
)

/**
 * Script d'un projet que Claude peut lancer pendant une exécution (spec 013 D2 bis) : approuvé par mentalyas, avec le
 * texte approuvé — un texte changé depuis rend le script non lançable.
 */
export const approvedCommands = sqliteTable(
  'approved_commands',
  {
    genesisId: text('genesis_id')
      .notNull()
      .references(() => neurons.id),
    script: text('script').notNull(),
    scriptText: text('script_text').notNull(),
    approvedAt: text('approved_at').notNull()
  },
  (t) => [primaryKey({ columns: [t.genesisId, t.script] })]
)

/** Lancement d'un script pendant une exécution : code, durée, fin de sortie (sans codes de couleur). */
export const commandRuns = sqliteTable(
  'command_runs',
  {
    id: text('id').primaryKey(),
    executionId: text('execution_id')
      .notNull()
      .references(() => executions.id),
    script: text('script').notNull(),
    exitCode: integer('exit_code'),
    timedOut: integer('timed_out', { mode: 'boolean' }).notNull().default(false),
    durationMs: integer('duration_ms').notNull(),
    output: text('output').notNull(),
    at: text('at').notNull()
  },
  (t) => [index('command_runs_execution_idx').on(t.executionId)]
)

/** Réglages génériques clé/valeur (JSON validé à la lecture). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull()
})
