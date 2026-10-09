import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { neurons } from './schemaNeurons'

/**
 * Git et GitHub (spec 021 data-model, migration 0039) : dépôts suivis, journal des écritures, clones en cours,
 * fusions et décisions de conflit, identités fusionnées, liens issue / PR ↔ nœud. Les dépôts eux-mêmes ne sont pas
 * stockés (relus dans git). Aucune colonne ne contient un message de commit, un diff, une adresse avec identifiant, un
 * jeton, un nom ou un e-mail d'auteur (FR-028, FR-039, SC-004).
 */

const now = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)

export const gitRepos = sqliteTable('git_repos', {
  genesisId: text('genesis_id')
    .primaryKey()
    .references(() => neurons.id),
  defaultRemote: text('default_remote'),
  /** Adresse SANS identifiant (`gitUrl.display`). */
  remoteUrl: text('remote_url'),
  /** `owner/name` si l'hôte est github.com. */
  githubRepo: text('github_repo'),
  upstreamRepo: text('upstream_repo'),
  lastFetchAt: text('last_fetch_at'),
  lastSeenCommit: text('last_seen_commit'),
  /** Commit à la dernière cartographie du projet par Claude (« Mettre à jour la carte » part de là). */
  mappedCommit: text('mapped_commit'),
  sensitiveCheckedHead: text('sensitive_checked_head'),
  /** Créé par un clone de l'app (jamais de confiance d'office). */
  cloned: integer('cloned', { mode: 'boolean' }).notNull().default(false),
  createdAt: now(),
  updatedAt: text('updated_at')
})

export const gitOperations = sqliteTable(
  'git_operations',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id').references(() => neurons.id),
    kind: text('kind', {
      enum: [
        'commit',
        'revert',
        'branch_create',
        'branch_switch',
        'fetch',
        'pull',
        'merge',
        'merge_finish',
        'merge_abort',
        'push',
        'repo_create',
        'clone',
        'fetch_all',
        'fork',
        'pr_create',
        'pr_comment',
        'issue_create',
        'extract'
      ]
    }).notNull(),
    status: text('status', { enum: ['ok', 'failed', 'cancelled'] }).notNull(),
    errorCode: text('error_code'),
    commitHash: text('commit_hash'),
    branch: text('branch'),
    remote: text('remote'),
    host: text('host'),
    number: integer('number'),
    count: integer('count'),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at').notNull()
  },
  (t) => [index('git_operations_genesis_idx').on(t.genesisId, t.startedAt)]
)

export const gitClonesRunning = sqliteTable('git_clones_running', {
  id: text('id').primaryKey(),
  /** Dossier CRÉÉ par l'app (absent avant, vérifié) : seule colonne à chemin absolu, le temps du clone. */
  targetDir: text('target_dir').notNull(),
  profile: text('profile', { enum: ['historique', 'superficiel'] }).notNull(),
  startedAt: text('started_at').notNull()
})

export const gitMergeSessions = sqliteTable(
  'git_merge_sessions',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id')
      .notNull()
      .references(() => neurons.id),
    mergeHead: text('merge_head').notNull(),
    head: text('head').notNull(),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at'),
    outcome: text('outcome', { enum: ['merged', 'aborted', 'lost'] })
  },
  (t) => [index('git_merge_sessions_genesis_idx').on(t.genesisId)]
)

export const gitConflictHunks = sqliteTable(
  'git_conflict_hunks',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => gitMergeSessions.id),
    path: text('path').notNull(),
    hunkIndex: integer('hunk_index').notNull(),
    proposal: text('proposal'),
    explanation: text('explanation'),
    confidence: text('confidence', { enum: ['sure', 'check'] }),
    decision: text('decision', { enum: ['ours', 'theirs', 'both', 'claude', 'manual'] }),
    manualText: text('manual_text'),
    updatedAt: text('updated_at').notNull()
  },
  (t) => [uniqueIndex('git_conflict_hunks_unique').on(t.sessionId, t.path, t.hunkIndex)]
)

export const gitAuthorAliases = sqliteTable(
  'git_author_aliases',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id')
      .notNull()
      .references(() => neurons.id),
    aliasKey: text('alias_key').notNull(),
    mainKey: text('main_key').notNull(),
    createdAt: now()
  },
  (t) => [uniqueIndex('git_author_aliases_unique').on(t.genesisId, t.aliasKey)]
)

export const gitIssueLinks = sqliteTable(
  'git_issue_links',
  {
    id: text('id').primaryKey(),
    genesisId: text('genesis_id')
      .notNull()
      .references(() => neurons.id),
    kind: text('kind', { enum: ['issue', 'pr'] }).notNull(),
    number: integer('number').notNull(),
    neuronId: text('neuron_id')
      .notNull()
      .references(() => neurons.id),
    createdAt: now(),
    deletedAt: text('deleted_at')
  },
  (t) => [index('git_issue_links_genesis_idx').on(t.genesisId)]
)
