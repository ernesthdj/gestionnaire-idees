import type { Finding } from './sensitive'

/** Droit du compte connecté sur le dépôt GitHub (`gh repo view --json viewerPermission`). */
export type RepoPermission = 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none' | 'unknown'

export type PushBlock = 'SENSITIVE_IN_HISTORY' | 'THIRD_PARTY_DEFAULT_BRANCH' | 'NO_WRITE_ACCESS'

export interface PushContext {
  readonly findings: readonly Finding[]
  /** `null` : remote hors GitHub (droits non vérifiés). */
  readonly github: {
    readonly permission: RepoPermission
    readonly ownerLogin: string
    readonly viewerLogin: string | null
    readonly defaultBranch: string | null
  } | null
  readonly targetBranch: string
}

export interface PushVerdict {
  readonly blocked: PushBlock | null
  /** D11 : dépôt à son compte, ou droit `admin` / `maintain`. */
  readonly ownedByViewer: boolean
  readonly isDefaultBranch: boolean
}

/**
 * Règles du push (spec 021 research R10, FR-014, FR-015, D11) : un constat bloquant (nom sensible, clé privée) bloque
 * toujours ; sur GitHub, sans droit d'écriture → `NO_WRITE_ACCESS` ; la branche par défaut d'un dépôt qui n'est pas à
 * soi (droit `write` seulement) → `THIRD_PARTY_DEFAULT_BRANCH` ; sinon permis, toujours après récapitulatif. Hors
 * GitHub : permis après récapitulatif (droits non vérifiés). Pur.
 */
export function pushVerdict(context: PushContext): PushVerdict {
  const github = context.github
  const ownedByViewer =
    github !== null &&
    ((github.viewerLogin !== null && github.ownerLogin.toLowerCase() === github.viewerLogin.toLowerCase()) ||
      github.permission === 'admin' ||
      github.permission === 'maintain')
  const isDefaultBranch = github?.defaultBranch !== null && github?.defaultBranch === context.targetBranch
  if (context.findings.some((finding) => finding.blocking)) {
    return { blocked: 'SENSITIVE_IN_HISTORY', ownedByViewer, isDefaultBranch }
  }
  if (github === null) return { blocked: null, ownedByViewer, isDefaultBranch }
  if (!ownedByViewer && ['read', 'triage', 'none'].includes(github.permission)) {
    return { blocked: 'NO_WRITE_ACCESS', ownedByViewer, isDefaultBranch }
  }
  if (isDefaultBranch && !ownedByViewer)
    return { blocked: 'THIRD_PARTY_DEFAULT_BRANCH', ownedByViewer, isDefaultBranch }
  return { blocked: null, ownedByViewer, isDefaultBranch }
}

/** Seuls les constats non bloquants (préfixes de jetons) s'acceptent un par un ; tous ceux de la plage doivent l'être. */
export function unacceptedFindings(findings: readonly Finding[], accepted: readonly string[]): Finding[] {
  const ok = new Set(accepted)
  return findings.filter((finding) => finding.blocking || !ok.has(finding.id))
}
