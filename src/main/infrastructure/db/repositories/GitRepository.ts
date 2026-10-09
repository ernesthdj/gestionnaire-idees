import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { AppError } from '../../../domain/errors'
import type { AppDatabase } from '../client'
import {
  gitAuthorAliases,
  gitClonesRunning,
  gitConflictHunks,
  gitMergeSessions,
  gitOperations,
  gitRepos
} from '../schemaGit'

export type GitOperationKind = (typeof gitOperations.$inferInsert)['kind']

export interface GitRepoRow {
  readonly genesisId: string
  readonly defaultRemote: string | null
  readonly remoteUrl: string | null
  readonly githubRepo: string | null
  readonly upstreamRepo: string | null
  readonly lastFetchAt: string | null
  readonly lastSeenCommit: string | null
  readonly mappedCommit: string | null
  readonly sensitiveCheckedHead: string | null
  readonly cloned: boolean
}

export interface GitOperationInput {
  readonly genesisId: string | null
  readonly kind: GitOperationKind
  readonly status: 'ok' | 'failed' | 'cancelled'
  readonly errorCode?: string | null
  readonly commitHash?: string | null
  readonly branch?: string | null
  readonly remote?: string | null
  readonly host?: string | null
  readonly number?: number | null
  readonly count?: number | null
  readonly startedAt: string
  readonly finishedAt: string
}

/** Une adresse ne doit jamais porter d'identifiant (`https://jeton@hote/…`, `https://nom:motdepasse@…`). */
function assertNoCredential(url: string | null | undefined): void {
  if (url === null || url === undefined) return
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(url)) {
    throw new AppError('VALIDATION', 'Adresse refusée : elle contient un identifiant.')
  }
}

const HASH = /^[0-9a-f]{7,40}$/

/**
 * Données git de l'app (spec 021 T011) : dépôts suivis, journal des écritures SANS contenu (codes, empreintes abrégées,
 * noms de branche et de remote, jamais un message, un diff, une adresse avec identifiant ni une sortie de git),
 * clones en cours (nettoyage au démarrage).
 */
export class GitRepository {
  constructor(private readonly db: AppDatabase) {}

  repo(genesisId: string): GitRepoRow | undefined {
    return this.db.select().from(gitRepos).where(eq(gitRepos.genesisId, genesisId)).get()
  }

  saveRepo(genesisId: string, patch: Partial<Omit<GitRepoRow, 'genesisId'>>): void {
    assertNoCredential(patch.remoteUrl)
    const updatedAt = new Date().toISOString()
    this.db
      .insert(gitRepos)
      .values({ genesisId, ...patch, updatedAt })
      .onConflictDoUpdate({ target: gitRepos.genesisId, set: { ...patch, updatedAt } })
      .run()
  }

  logOperation(input: GitOperationInput): string {
    const id = randomUUID()
    const commitHash = input.commitHash === undefined || input.commitHash === null ? null : input.commitHash.slice(0, 7)
    if (commitHash !== null && !HASH.test(commitHash)) throw new AppError('VALIDATION', 'Empreinte invalide.')
    this.db
      .insert(gitOperations)
      .values({
        id,
        genesisId: input.genesisId,
        kind: input.kind,
        status: input.status,
        errorCode: input.errorCode ?? null,
        commitHash,
        branch: input.branch ?? null,
        remote: input.remote ?? null,
        host: input.host ?? null,
        number: input.number ?? null,
        count: input.count ?? null,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt
      })
      .run()
    return id
  }

  operations(genesisId: string, limit = 50): (typeof gitOperations.$inferSelect)[] {
    return this.db
      .select()
      .from(gitOperations)
      .where(eq(gitOperations.genesisId, genesisId))
      .orderBy(desc(gitOperations.startedAt))
      .limit(limit)
      .all()
  }

  addRunningClone(entry: {
    readonly id: string
    readonly targetDir: string
    readonly profile: 'historique' | 'superficiel'
  }): void {
    this.db
      .insert(gitClonesRunning)
      .values({ ...entry, startedAt: new Date().toISOString() })
      .run()
  }

  removeRunningClone(id: string): void {
    this.db.delete(gitClonesRunning).where(eq(gitClonesRunning.id, id)).run()
  }

  /** Commit fusionné de la fusion ouverte par l'app sur ce projet (US4) ; `null` : aucune. */
  openMergeHead(genesisId: string): string | null {
    return (
      this.db
        .select({ mergeHead: gitMergeSessions.mergeHead })
        .from(gitMergeSessions)
        .where(and(eq(gitMergeSessions.genesisId, genesisId), isNull(gitMergeSessions.finishedAt)))
        .get()?.mergeHead ?? null
    )
  }

  runningClones(): (typeof gitClonesRunning.$inferSelect)[] {
    return this.db.select().from(gitClonesRunning).all()
  }

  // ── Fusions et conflits (US4) ─────────────────────────────────────────────────────────────────────────────────────

  openMergeSession(input: { readonly genesisId: string; readonly mergeHead: string; readonly head: string }): string {
    const id = randomUUID()
    this.db
      .insert(gitMergeSessions)
      .values({ id, ...input, startedAt: new Date().toISOString() })
      .run()
    return id
  }

  /** Fusion ouverte par l'app sur ce projet ; `undefined` : aucune. */
  openSession(genesisId: string): typeof gitMergeSessions.$inferSelect | undefined {
    return this.db
      .select()
      .from(gitMergeSessions)
      .where(and(eq(gitMergeSessions.genesisId, genesisId), isNull(gitMergeSessions.finishedAt)))
      .get()
  }

  /** Fin de fusion : la session reste (traçabilité sans contenu), ses blocs sont effacés (le code d'autrui ne reste pas). */
  closeSession(id: string, outcome: 'merged' | 'aborted' | 'lost'): void {
    this.db.transaction((tx) => {
      tx.delete(gitConflictHunks).where(eq(gitConflictHunks.sessionId, id)).run()
      tx.update(gitMergeSessions)
        .set({ finishedAt: new Date().toISOString(), outcome })
        .where(eq(gitMergeSessions.id, id))
        .run()
    })
  }

  hunks(sessionId: string, path: string): (typeof gitConflictHunks.$inferSelect)[] {
    return this.db
      .select()
      .from(gitConflictHunks)
      .where(and(eq(gitConflictHunks.sessionId, sessionId), eq(gitConflictHunks.path, path)))
      .all()
  }

  saveHunk(
    sessionId: string,
    path: string,
    hunkIndex: number,
    patch: Partial<
      Pick<typeof gitConflictHunks.$inferInsert, 'proposal' | 'explanation' | 'confidence' | 'decision' | 'manualText'>
    >
  ): void {
    const updatedAt = new Date().toISOString()
    this.db
      .insert(gitConflictHunks)
      .values({ id: randomUUID(), sessionId, path, hunkIndex, ...patch, updatedAt })
      .onConflictDoUpdate({
        target: [gitConflictHunks.sessionId, gitConflictHunks.path, gitConflictHunks.hunkIndex],
        set: { ...patch, updatedAt }
      })
      .run()
  }

  /** Fichiers validés pendant la fusion (bloc « résolu », index -1). */
  resolvedPaths(sessionId: string): string[] {
    return this.db
      .select({ path: gitConflictHunks.path })
      .from(gitConflictHunks)
      .where(and(eq(gitConflictHunks.sessionId, sessionId), eq(gitConflictHunks.hunkIndex, -1)))
      .all()
      .map((row) => row.path)
  }

  // ── Identités fusionnées (US5) ────────────────────────────────────────────────────────────────────────────────────

  /** Clé secondaire → clé principale, pour ce projet. */
  aliases(genesisId: string): Map<string, string> {
    return new Map(
      this.db
        .select({ aliasKey: gitAuthorAliases.aliasKey, mainKey: gitAuthorAliases.mainKey })
        .from(gitAuthorAliases)
        .where(eq(gitAuthorAliases.genesisId, genesisId))
        .all()
        .map((row) => [row.aliasKey, row.mainKey] as const)
    )
  }

  mergeAuthors(genesisId: string, mainKey: string, aliasKeys: readonly string[]): void {
    this.db.transaction((tx) => {
      for (const aliasKey of aliasKeys) {
        tx.insert(gitAuthorAliases)
          .values({ id: randomUUID(), genesisId, aliasKey, mainKey })
          .onConflictDoUpdate({ target: [gitAuthorAliases.genesisId, gitAuthorAliases.aliasKey], set: { mainKey } })
          .run()
      }
    })
  }

  unmergeAuthor(genesisId: string, aliasKey: string): boolean {
    return (
      this.db
        .delete(gitAuthorAliases)
        .where(and(eq(gitAuthorAliases.genesisId, genesisId), eq(gitAuthorAliases.aliasKey, aliasKey)))
        .run().changes > 0
    )
  }
}
