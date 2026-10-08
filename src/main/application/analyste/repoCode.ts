import { resolve } from 'node:path'
import { inside, real, sameDir } from './RepoGuard'

/**
 * Le chemin relatif (déjà normalisé par `normalizeRepoPath`) existe-t-il, une fois les liens résolus, DANS le dépôt ?
 * Un lien ou une jonction qui sort du dépôt est refusé (spec 019 FR-016).
 */
export function existsInRepo(repoPath: string, relativePath: string): boolean {
  const root = real(repoPath)
  if (root === null) return false
  const target = real(resolve(root, relativePath))
  return target !== null && inside(target, root)
}

/**
 * Le graphe est-il plus ancien que le dernier commit du dépôt ? Jamais analysé (ou date illisible) : périmé.
 * Sans date de commit (git absent), le graphe stocké est gardé.
 */
export function graphIsStale(analyzedAt: string | null, lastCommitMs: number | null): boolean {
  if (analyzedAt === null) return true
  const at = Date.parse(analyzedAt)
  if (Number.isNaN(at)) return true
  return lastCommitMs !== null && at < lastCommitMs
}

/** Date du dernier commit du dépôt (ms), `null` si git ne répond pas. */
export async function lastCommitAt(
  repoPath: string,
  git: (cwd: string, args: readonly string[]) => Promise<{ readonly code: number | null; readonly output: string }>
): Promise<number | null> {
  const result = await git(repoPath, ['log', '-1', '--format=%ct'])
  const seconds = Number(result.output.trim())
  return result.code === 0 && Number.isInteger(seconds) && seconds > 0 ? seconds * 1000 : null
}

export interface GraphSources {
  /** Genesis liés à un dossier (spec 008/016), hors archivés. */
  readonly linkedFolders: () => readonly { readonly id: string; readonly projectDir: string }[]
  /** Projet repris dont la racine est ce dossier (spec 017). */
  readonly projectByRoot: (rootDir: string) => { readonly genesisId: string } | undefined
  /** Le genesis a-t-il un graphe de code (fichiers analysés) ? */
  readonly hasGraph: (genesisId: string) => boolean
}

/**
 * Genesis dont le graphe de code décrit le dépôt (spec 019 research R4 révisé) : d'abord un genesis qui lie déjà le
 * dépôt (comparé par chemin réel), sinon un projet repris qui pointe sur lui ; `null` si aucun n'a de graphe.
 */
export function graphGenesisFor(repoPath: string, sources: GraphSources): string | null {
  const root = real(repoPath) ?? repoPath
  for (const linked of sources.linkedFolders()) {
    const dir = real(linked.projectDir) ?? linked.projectDir
    if (sameDir(dir, root) && sources.hasGraph(linked.id)) return linked.id
  }
  const project = sources.projectByRoot(root) ?? sources.projectByRoot(repoPath)
  return project !== undefined && sources.hasGraph(project.genesisId) ? project.genesisId : null
}
