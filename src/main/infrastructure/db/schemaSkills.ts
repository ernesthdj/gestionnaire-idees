import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Arbre de skills (spec 020 data-model, migration 0033) : fiches, domaines, liens, brouillons, versions et imports.
 * Les skills eux-mêmes ne sont pas stockés (inventoriés sur le disque). Dates en millisecondes depuis l'époque.
 */

export const skillDomains = sqliteTable('skill_domains', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  position: integer('position').notNull(),
  /** Domaine proposé par Claude, pas encore validé par mentalyas. */
  pending: integer('pending', { mode: 'boolean' }).notNull().default(false)
})

export const skillCards = sqliteTable('skill_cards', {
  skillId: text('skill_id').primaryKey(),
  contentHash: text('content_hash').notNull(),
  /** Fiche validée (JSON). */
  card: text('card').notNull(),
  /** Grille de qualité 0–5 par critère, justifiée (JSON). */
  grid: text('grid').notNull(),
  starsClaude: integer('stars_claude').notNull(),
  /** Note de mentalyas : prime sur celle de Claude. */
  starsUser: integer('stars_user'),
  domainId: text('domain_id').references(() => skillDomains.id),
  domainSource: text('domain_source', { enum: ['claude', 'user'] }).notNull(),
  analyzedAt: integer('analyzed_at').notNull(),
  model: text('model').notNull()
})

export const skillLinks = sqliteTable(
  'skill_links',
  {
    id: text('id').primaryKey(),
    fromId: text('from_id').notNull(),
    toId: text('to_id').notNull(),
    kind: text('kind', { enum: ['enchaine_vers', 'complete', 'alternative_a', 'appelle'] }).notNull(),
    origin: text('origin', { enum: ['claude', 'user'] }).notNull(),
    reason: text('reason'),
    /** Lien de Claude retiré par mentalyas : jamais reproposé. */
    removed: integer('removed', { mode: 'boolean' }).notNull().default(false)
  },
  (t) => [uniqueIndex('skill_links_unique').on(t.fromId, t.toId, t.kind)]
)

export const skillImports = sqliteTable('skill_imports', {
  id: text('id').primaryKey(),
  /** Adresse sans identifiant. */
  repo: text('repo').notNull(),
  commit: text('commit'),
  /** `ready` = dépôt présent dans la bibliothèque (D12) ; `done` = ancien import en quarantaine (avant D12). */
  status: text('status', {
    enum: ['clone', 'reperage', 'audit', 'ready', 'done', 'cancelled', 'failed']
  }).notNull(),
  errorCode: text('error_code'),
  createdAt: integer('created_at').notNull(),
  finishedAt: integer('finished_at'),
  /** Copie gardée, relative à la racine de la bibliothèque (`<hôte>/<auteur>/<dépôt>`, migration 0034). */
  folder: text('folder'),
  updatedAt: integer('updated_at'),
  /** Plus de skills trouvés que la limite de repérage. */
  truncated: integer('truncated', { mode: 'boolean' }).notNull().default(false),
  /** Copies d'un même skill écartées au repérage (traductions, autres outils ; migration 0035). */
  skippedCopies: integer('skipped_copies').notNull().default(0)
})

export const skillImportCandidates = sqliteTable(
  'skill_import_candidates',
  {
    id: text('id').primaryKey(),
    importId: text('import_id')
      .notNull()
      .references(() => skillImports.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relDir: text('rel_dir').notNull(),
    /** `{ path, size, executable }[]` (JSON). */
    files: text('files').notNull(),
    verdict: text('verdict', { enum: ['sur', 'a_revoir', 'dangereux'] }).notNull(),
    /** Verdict des règles fixes ; `{ text, line? }[]` ≤ 8 (JSON), la première entrée porte la description. */
    reasons: text('reasons').notNull(),
    kept: integer('kept', { mode: 'boolean' }).notNull().default(false),
    /** Empreinte des fichiers du skill (migration 0034) : un audit de Claude ne vaut que pour cette empreinte. */
    contentHash: text('content_hash'),
    claudeVerdict: text('claude_verdict', { enum: ['sur', 'a_revoir', 'dangereux'] }),
    /** `{ text, line? }[]` (JSON). */
    claudeReasons: text('claude_reasons'),
    claudeHash: text('claude_hash')
  },
  (t) => [index('skill_import_candidates_import_idx').on(t.importId)]
)

export const skillDrafts = sqliteTable(
  'skill_drafts',
  {
    id: text('id').primaryKey(),
    family: text('family', { enum: ['perso', 'projet'] }).notNull(),
    projectGenesisId: text('project_genesis_id'),
    name: text('name').notNull(),
    description: text('description').notNull(),
    /** Corps du `SKILL.md`, sans en-tête. */
    content: text('content').notNull(),
    /** `{ path, content }[]` ≤ 20 (JSON). */
    annexes: text('annexes').notNull().default('[]'),
    /** Scripts d'import autorisés un par un (JSON) ; vidé dès que Claude réécrit le brouillon (analyse H2). */
    allowedScripts: text('allowed_scripts').notNull().default('[]'),
    /** Empreinte du skill installé vu à la création du brouillon (conflit disque). */
    baseHash: text('base_hash'),
    origin: text('origin', { enum: ['claude', 'import', 'duplicate'] }).notNull(),
    importId: text('import_id').references(() => skillImports.id, { onDelete: 'set null' }),
    /** `{ repo, commit, path }` pour un import (JSON). */
    source: text('source'),
    status: text('status', { enum: ['open', 'installed', 'discarded'] })
      .notNull()
      .default('open'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [index('skill_drafts_status_idx').on(t.status, t.family, t.name)]
)

export const skillVersions = sqliteTable(
  'skill_versions',
  {
    id: text('id').primaryKey(),
    skillId: text('skill_id').notNull(),
    /** Dossier de sauvegarde, relatif au profil (`skill-versions/<skill>/<empreinte>`). */
    folder: text('folder').notNull(),
    contentHash: text('content_hash').notNull(),
    batchId: text('batch_id').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('skill_versions_skill_idx').on(t.skillId, t.createdAt)]
)
