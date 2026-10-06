import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { neurons } from './schemaNeurons'

/**
 * Reprise d'un projet existant (spec 017 data-model) : le projet repris, son graphe de code (modules, fichiers,
 * symboles, liens, points d'entrée), les corrections de mentalyas, les passes et l'état de l'explorateur. Chemins
 * relatifs au projet, séparateur `/` ; jamais de contenu de fichier.
 */

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)

export const codeProjects = sqliteTable(
  'code_projects',
  {
    genesisId: text('genesis_id')
      .primaryKey()
      .references(() => neurons.id),
    /** Chemin réel du dossier source, choisi par mentalyas (dossier local ou cible du clone). */
    rootDir: text('root_dir').notNull(),
    source: text('source', { enum: ['folder', 'git'] }).notNull(),
    /** Adresse du dépôt, sans identifiants. */
    remoteUrl: text('remote_url'),
    confidentiality: text('confidentiality', { enum: ['claude', 'local'] }).notNull(),
    confidentialityChangedAt: text('confidentiality_changed_at').notNull(),
    createdAt: createdAt(),
    analysisState: text('analysis_state', { enum: ['idle', 'running', 'failed', 'interrupted'] })
      .notNull()
      .default('idle'),
    analyzedAt: text('analyzed_at')
  },
  (t) => [uniqueIndex('code_projects_root_idx').on(t.rootDir)]
)

export const codeModules = sqliteTable(
  'code_modules',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id').notNull(),
    /** Clé stable : `npm:@app/core`, `csproj:App.Core`, `dir:app/Billing`. */
    key: text('key').notNull(),
    name: text('name').notNull(),
    rootPath: text('root_path').notNull(),
    kind: text('kind', { enum: ['package', 'csproj', 'folder'] }).notNull(),
    summary: text('summary'),
    analogy: text('analogy')
  },
  (t) => [uniqueIndex('code_modules_key_idx').on(t.genesisId, t.key)]
)

export const codeFiles = sqliteTable(
  'code_files',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id').notNull(),
    moduleId: text('module_id'),
    path: text('path').notNull(),
    lang: text('lang', { enum: ['ts', 'tsx', 'js', 'cs', 'php', 'other'] }).notNull(),
    hash: text('hash').notNull(),
    lines: integer('lines').notNull(),
    status: text('status', { enum: ['ok', 'parse_error', 'unsupported', 'too_large'] }).notNull(),
    error: text('error')
  },
  (t) => [uniqueIndex('code_files_path_idx').on(t.genesisId, t.path), index('code_files_module_idx').on(t.moduleId)]
)

export const codeSymbols = sqliteTable(
  'code_symbols',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id').notNull(),
    parentId: text('parent_id'),
    kind: text('kind', { enum: ['namespace', 'class', 'interface', 'function', 'method'] }).notNull(),
    name: text('name').notNull(),
    qualifiedName: text('qualified_name').notNull(),
    startLine: integer('start_line').notNull(),
    endLine: integer('end_line').notNull(),
    complexity: integer('complexity').notNull().default(1),
    category: text('category', { enum: ['domain', 'orchestration', 'infrastructure', 'plumbing'] }).notNull(),
    categorySource: text('category_source', { enum: ['rules', 'claude', 'ollama', 'user'] }).notNull(),
    categoryReason: text('category_reason')
  },
  (t) => [
    index('code_symbols_file_idx').on(t.fileId),
    index('code_symbols_qualified_idx').on(t.fileId, t.qualifiedName)
  ]
)

export const codeEdges = sqliteTable(
  'code_edges',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id').notNull(),
    fromSymbolId: text('from_symbol_id').notNull(),
    /** `null` : cible non résolue (`raw_target` dit ce qui était appelé). */
    toSymbolId: text('to_symbol_id'),
    rawTarget: text('raw_target').notNull(),
    kind: text('kind', { enum: ['import', 'call', 'implements', 'route', 'injects'] }).notNull(),
    provenance: text('provenance', { enum: ['syntax', 'deduced', 'uncertain', 'user'] }).notNull(),
    reason: text('reason'),
    count: integer('count').notNull().default(1)
  },
  (t) => [
    index('code_edges_from_idx').on(t.fromSymbolId),
    index('code_edges_to_idx').on(t.toSymbolId),
    index('code_edges_provenance_idx').on(t.genesisId, t.provenance)
  ]
)

export const codeEntryPoints = sqliteTable('code_entry_points', {
  symbolId: text('symbol_id').primaryKey(),
  kind: text('kind', { enum: ['http_route', 'main', 'cli', 'event', 'job'] }).notNull(),
  label: text('label').notNull()
})

/** Corrections de mentalyas (catégorie, cible d'un appel), réappliquées après chaque analyse (FR-018). */
export const codeOverrides = sqliteTable(
  'code_overrides',
  {
    genesisId: text('genesis_id').notNull(),
    target: text('target').notNull(),
    value: text('value'),
    createdAt: createdAt()
  },
  (t) => [primaryKey({ columns: [t.genesisId, t.target] })]
)

/** Passes d'analyse, de résolution et de guide : jamais de code ni de chemin complet. */
export const codeRuns = sqliteTable(
  'code_runs',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id').notNull(),
    kind: text('kind', { enum: ['analysis', 'resolution', 'guide'] }).notNull(),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    state: text('state', { enum: ['running', 'done', 'failed', 'cancelled', 'interrupted'] }).notNull(),
    statsJson: text('stats_json')
  },
  (t) => [index('code_runs_genesis_idx').on(t.genesisId)]
)

export const codeLayout = sqliteTable(
  'code_layout',
  {
    genesisId: text('genesis_id').notNull(),
    level: integer('level').notNull(),
    parentKey: text('parent_key').notNull(),
    nodeKey: text('node_key').notNull(),
    x: real('x').notNull(),
    y: real('y').notNull()
  },
  (t) => [primaryKey({ columns: [t.genesisId, t.level, t.parentKey, t.nodeKey] })]
)

export const codeExplorerState = sqliteTable('code_explorer_state', {
  genesisId: text('genesis_id').primaryKey(),
  filtersJson: text('filters_json').notNull(),
  lastLevel: integer('last_level').notNull().default(1),
  lastParentKey: text('last_parent_key')
})
