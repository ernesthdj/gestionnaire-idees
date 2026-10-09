import * as args from '../../domain/git/args'
import { isSensitivePath } from '../../domain/git/sensitive'
import { mapUpdatePrompt, mergeChanges, parseNameStatus, type FileChange } from '../../domain/structure/mapUpdate'
import { AppError } from '../../domain/errors'
import type { GitRepository } from '../../infrastructure/db/repositories/GitRepository'
import type { GitAccess } from '../git/GitAccess'

export interface MapUpdateDeps {
  readonly access: Pick<GitAccess, 'ready' | 'read' | 'readStatus' | 'head'>
  readonly repository: Pick<GitRepository, 'repo' | 'saveRepo'>
  /** Nombre d'éléments de la carte de structure du genesis (0 : pas encore cartographié). */
  readonly elementCount: (genesisId: string) => number
  readonly localOnly: (genesisId: string) => boolean
}

export interface MapUpdatePlan {
  /** Consigne à envoyer à la conversation du genesis ; `null` : rien n'a changé. */
  readonly prompt: string | null
  readonly files: number
  readonly since: 'cartographie' | 'commits recents'
}

/**
 * « Mettre à jour la carte » (spec 022, 2026-10-10) : l'app calcule elle-même ce qui a changé depuis la dernière
 * cartographie (commits depuis le repère + fichiers non commités ; sans repère, les 20 derniers commits), sans fichier
 * sensible, et prépare la consigne de mise à jour ; Claude ne met à jour que les éléments concernés. Le repère avance
 * à la fin d'une cartographie réussie.
 */
export class MapUpdateService {
  constructor(private readonly deps: MapUpdateDeps) {}

  async plan(genesisId: string): Promise<MapUpdatePlan> {
    if (this.deps.localOnly(genesisId)) {
      throw new AppError('LOCAL_ONLY', 'Projet « Local uniquement » : la carte n’est pas mise à jour par Claude.')
    }
    if (this.deps.elementCount(genesisId) === 0) {
      throw new AppError('NO_MAP', 'Ce projet n’a pas encore de carte : cartographie-le d’abord.')
    }
    const repo = await this.deps.access.ready(genesisId)
    const mapped = this.deps.repository.repo(genesisId)?.mappedCommit ?? null
    const head = await this.deps.access.head(repo)
    let committed: FileChange[] = []
    let since: MapUpdatePlan['since'] = 'commits recents'
    if (head !== null) {
      const fromMark = mapped === null ? null : await this.deps.access.read(repo, args.mappedChangesArgs(mapped))
      if (fromMark !== null && fromMark.code === 0) {
        committed = parseNameStatus(fromMark.stdout)
        since = 'cartographie'
      } else {
        // Sans repère (ou repère disparu après une réécriture d'historique) : les derniers commits.
        committed = parseNameStatus((await this.deps.access.read(repo, args.recentChangesArgs())).stdout)
      }
    }
    const status = await this.deps.access.readStatus(repo)
    const working = status.entries.map((entry): FileChange => ({
      path: entry.path,
      kind: entry.status === '?' || entry.status === 'A' ? 'ajouté' : entry.status === 'D' ? 'supprimé' : 'modifié'
    }))
    const changes = mergeChanges(committed, working).filter((change) => !isSensitivePath(change.path))
    return {
      prompt: changes.length === 0 ? null : mapUpdatePrompt(changes, since),
      files: changes.length,
      since
    }
  }

  /** Fin d'une cartographie réussie : le repère avance au commit actuel. */
  async markMapped(genesisId: string): Promise<{ readonly commit: string | null }> {
    const repo = await this.deps.access.ready(genesisId)
    const head = await this.deps.access.head(repo)
    if (head !== null) this.deps.repository.saveRepo(genesisId, { mappedCommit: head })
    return { commit: head }
  }
}
