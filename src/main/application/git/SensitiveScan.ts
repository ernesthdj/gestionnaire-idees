import * as args from '../../domain/git/args'
import { contentFindings, fileNameFinding, type Finding } from '../../domain/git/sensitive'
import type { GitAccess, ReadyRepo } from './GitAccess'

/** Bornes du contrôle (research R10) : au-delà, noms seulement, avec un avertissement. */
export const SCAN_LIMITS = { commits: 5_000, paths: 50_000, files: 2_000, fileBytes: 1024 * 1024 } as const

export interface ScanResult {
  readonly findings: readonly Finding[]
  /** Contrôle limité aux noms de fichiers (trop de commits ou de fichiers). */
  readonly namesOnly: boolean
}

/** Commits et fichiers ajoutés ou modifiés dans la sortie `log -z --format=%x00%H --name-only`. */
export function parseOutgoingNames(output: string): { readonly commit: string; readonly paths: string[] }[] {
  const commits: { commit: string; paths: string[] }[] = []
  // L'en-tête et le premier chemin sont séparés par un retour à la ligne, les chemins par NUL.
  for (const value of output.split(/[\0\n]/)) {
    if (value === '') continue
    if (/^[0-9a-f]{40}$/.test(value)) commits.push({ commit: value, paths: [] })
    else commits.at(-1)?.paths.push(value)
  }
  return commits
}

/**
 * Contrôle des fichiers sensibles sur la plage à pousser (spec 021 T022, FR-014, SC-003) : un nom sensible dans N'IMPORTE
 * QUEL commit de la plage (pas seulement le dernier) et le contenu des fichiers texte ajoutés ou modifiés (clé privée
 * bloquante, préfixes de jetons signalés). Le contenu est lu par `cat-file blob` (aucun filtre), jamais renvoyé en clair.
 */
export async function scanOutgoing(
  access: GitAccess,
  repo: ReadyRepo,
  range: { readonly branch: string; readonly remote: string; readonly upstream: string | null }
): Promise<ScanResult> {
  const names = await access.read(repo, args.outgoingNamesArgs(range.branch, range.remote, range.upstream), {
    maxOutput: 16 * 1024 * 1024
  })
  const commits = parseOutgoingNames(names.stdout)
  const totalPaths = commits.reduce((sum, entry) => sum + entry.paths.length, 0)
  const findings: Finding[] = []
  for (const { commit, paths } of commits) {
    for (const path of paths) {
      const finding = fileNameFinding(path, commit)
      if (finding !== null) findings.push(finding)
    }
  }
  const namesOnly = names.truncated || commits.length > SCAN_LIMITS.commits || totalPaths > SCAN_LIMITS.paths
  if (namesOnly) return { findings: dedupe(findings), namesOnly: true }
  let read = 0
  for (const { commit, paths } of commits) {
    for (const path of paths) {
      if (fileNameFinding(path, commit) !== null) continue
      if (read >= SCAN_LIMITS.files) return { findings: dedupe(findings), namesOnly: true }
      read += 1
      const blob = await access.read(repo, args.blobArgs(commit, path), { maxOutput: SCAN_LIMITS.fileBytes })
      if (blob.code !== 0 || blob.truncated || blob.stdout.includes('\0')) continue
      findings.push(...contentFindings(path, commit, blob.stdout))
    }
  }
  return { findings: dedupe(findings), namesOnly: false }
}

/** Un même fichier sensible présent dans plusieurs commits : un constat par chemin et par motif. */
function dedupe(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>()
  return findings.filter((finding) => {
    const key = `${finding.kind}:${finding.path}:${finding.line ?? ''}:${finding.excerpt ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
