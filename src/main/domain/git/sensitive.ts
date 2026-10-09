import { createHash } from 'node:crypto'
import { classifyFile } from '../reprise/fileFilter'
import { SENSITIVE_PATTERNS } from './sensitivePatterns'

/**
 * Fichiers et contenus sensibles (spec 021 T006, FR-014) : même règle de nom que l'import d'un projet (spec 017,
 * `classifyFile` : `.env`, clés, réglages à secrets ; modèles `.env.example` exceptés), plus des motifs de contenu.
 * Un nom sensible ou une clé privée bloquent ; un préfixe de jeton est signalé (non bloquant). L'extrait affiché est
 * masqué : le secret n'est jamais renvoyé en clair. Pur.
 */

export type FindingKind = 'file_name' | 'private_key' | 'token_pattern'

export interface Finding {
  readonly id: string
  readonly kind: FindingKind
  readonly path: string
  readonly commit: string
  readonly line?: number
  readonly excerpt?: string
  readonly reason: string
  readonly blocking: boolean
}

/** Nom de fichier sensible (jamais cochable, jamais lu, jamais poussé). */
export function isSensitivePath(path: string): boolean {
  return classifyFile(path.replace(/\\/g, '/'), 0, () => false).kind === 'sensitive'
}

const findingId = (parts: readonly (string | number | undefined)[]): string =>
  createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16)

/** Extrait masqué : les 4 premiers caractères du motif, le reste en `•`, la ligne bornée. */
function masked(line: string, match: RegExpExecArray): string {
  const secret = match[0]
  const shown = `${secret.slice(0, 4)}${'•'.repeat(Math.min(12, Math.max(4, secret.length - 4)))}`
  const text = `${line.slice(0, match.index)}${shown}${line.slice(match.index + secret.length)}`.trim()
  return text.length <= 120 ? text : `${text.slice(0, 119)}…`
}

/** Constat de nom de fichier (commit donné), ou rien. */
export function fileNameFinding(path: string, commit: string): Finding | null {
  if (!isSensitivePath(path)) return null
  return {
    id: findingId(['file_name', path, commit]),
    kind: 'file_name',
    path,
    commit,
    reason: 'Fichier de secrets ou de clés',
    blocking: true
  }
}

/** Constats de contenu d'un fichier texte (au plus un par ligne et par motif). */
export function contentFindings(path: string, commit: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const pattern of SENSITIVE_PATTERNS) {
      const match = pattern.regex.exec(line)
      if (match === null) continue
      findings.push({
        id: findingId([pattern.id, path, commit, index + 1]),
        kind: pattern.kind,
        path,
        commit,
        line: index + 1,
        excerpt: masked(line, match),
        reason: pattern.reason,
        blocking: pattern.kind === 'private_key'
      })
    }
  })
  return findings
}
