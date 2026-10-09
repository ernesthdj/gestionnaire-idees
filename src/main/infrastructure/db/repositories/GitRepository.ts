import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { AppError } from '../../../domain/errors'
import type { AppDatabase } from '../client'
import { gitClonesRunning, gitMergeSessions, gitOperations, gitRepos } from '../schemaGit'

export type GitOperationKind = (typeof gitOperations.$inferInsert)['kind']

export interface GitRepoRow {
  readonly genesisId: string
  readonly defaultRemote: string | null
  readonly remoteUrl: string | null
  readonly githubRepo: string | null
  readonly upstreamRepo: string | null
  readonly lastFetchAt: string | null
  readonly lastSeenCommit: string | null
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
}
