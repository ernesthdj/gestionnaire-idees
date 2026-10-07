import { createHash } from 'node:crypto'
import type { AnalysteProposalOut, ProposalCategory, ProposalRisk } from '@shared/analyste/proposals'
import type { AggregateEntry } from './aggregate'

/**
 * Contrôle des propositions de l'Analyste (spec 019 FR-016 à FR-019, `L3-analyste-analyse.md` §4), après le schéma
 * Zod : rien de ce que Claude écrit n'est cru sur parole. Pur : l'existence d'un fichier est injectée.
 */

export interface ObservationEvidence {
  readonly key: string
  readonly sentence: string
  readonly signature: string
}

export interface CodeEvidence {
  readonly path: string
  readonly start?: number
  readonly end?: number
}

export interface CheckedProposal {
  readonly category: ProposalCategory
  readonly title: string
  readonly finding: string
  readonly proposal: string
  readonly gain: string
  readonly risk: ProposalRisk
  readonly severity: number
  readonly confidence: number
  readonly evidence: { readonly observations: ObservationEvidence[]; readonly code: CodeEvidence[] }
  readonly files: string[]
  /** Évolutivité sans preuve : affichée « idée, sans preuve d'usage » (FR-016). */
  readonly withoutEvidence: boolean
  readonly dedupeKey: string
}

/** Proposition déjà connue : ouverte (doublon) ou refusée (mémoire des refus). */
export interface ProposalMemory {
  readonly dedupeKey: string
  readonly status: string
  /** Faits cités par cette proposition (signatures des agrégats). */
  readonly signatures: readonly string[]
}

export type RejectReason =
  | 'invalid_path'
  | 'unknown_key'
  | 'no_evidence'
  | 'ia_without_repetition'
  | 'duplicate'
  | 'refused_before'
  | 'over_limit'

export interface CheckInput {
  readonly proposals: readonly AnalysteProposalOut[]
  /** Agrégats envoyés dans le dossier (clé → agrégat). */
  readonly entries: ReadonlyMap<string, AggregateEntry>
  /** Le chemin relatif (déjà normalisé) désigne-t-il un fichier ou dossier existant DANS le dépôt ? */
  readonly exists: (relativePath: string) => boolean
  readonly memory: readonly ProposalMemory[]
  /** Plafond de propositions gardées (FR-017). */
  readonly max: number
}

export interface CheckResult {
  readonly kept: CheckedProposal[]
  readonly rejected: { readonly title: string; readonly reason: RejectReason }[]
}

/** Statuts d'une proposition encore ouverte : une nouvelle proposition identique serait un doublon. */
export const OPEN_STATUSES = ['new', 'postponed', 'accepted', 'coding', 'to_fix', 'ready'] as const

const FORBIDDEN_SEGMENTS = new Set(['', '.', '..', '.git', 'node_modules', '.analyste'])

/**
 * Chemin relatif au dépôt, normalisé (séparateur `/`, sans `./` de tête) ; `null` s'il est absolu, remonte (`..`),
 * vise un lecteur, le dossier git, les dépendances ou les copies de travail de l'Analyste.
 */
export function normalizeRepoPath(raw: string): string | null {
  const path = raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/\/+$/, '')
  if (path === '' || path.includes('\u0000') || path.startsWith('/') || path.startsWith('~')) return null
  if (/^[A-Za-z]:/.test(path)) return null
  const segments = path.split('/')
  if (segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) return null
  return segments.join('/')
}

/** Empreinte de dédoublonnage : catégorie et fichiers visés triés (titre si aucun fichier). */
export function dedupeKeyOf(category: string, files: readonly string[], title: string): string {
  const basis = files.length > 0 ? [...files].sort().join('\n') : `titre:${title.trim().toLowerCase()}`
  return createHash('sha256').update(`${category}\u0000${basis}`).digest('hex').slice(0, 32)
}

type Verdict =
  { readonly ok: true; readonly value: CheckedProposal } | { readonly ok: false; readonly reason: RejectReason }

function verify(raw: AnalysteProposalOut, input: CheckInput): Verdict {
  const files: string[] = []
  for (const candidate of raw.fichiersVises) {
    const path = normalizeRepoPath(candidate)
    if (path === null || !input.exists(path)) return { ok: false, reason: 'invalid_path' }
    if (!files.includes(path)) files.push(path)
  }
  const code: CodeEvidence[] = []
  for (const location of raw.preuves.code) {
    const path = normalizeRepoPath(location.chemin)
    if (path === null || !input.exists(path)) return { ok: false, reason: 'invalid_path' }
    if (location.debut !== undefined && location.fin !== undefined && location.fin < location.debut) {
      return { ok: false, reason: 'invalid_path' }
    }
    code.push({
      path,
      ...(location.debut === undefined ? {} : { start: location.debut }),
      ...(location.fin === undefined ? {} : { end: location.fin })
    })
  }
  const observations: ObservationEvidence[] = []
  for (const key of new Set(raw.preuves.observations)) {
    const entry = input.entries.get(key)
    if (entry === undefined) return { ok: false, reason: 'unknown_key' }
    observations.push({ key, sentence: entry.sentence, signature: entry.signature })
  }
  const withoutEvidence = observations.length === 0 && code.length === 0
  if (withoutEvidence && raw.categorie !== 'evolutivite') return { ok: false, reason: 'no_evidence' }
  // FR-019 : remplacer une tâche d'IA par du code exige une répétition observée.
  if (raw.categorie === 'ia_vers_code' && !observations.some((item) => item.key.startsWith('obs:ia:'))) {
    return { ok: false, reason: 'ia_without_repetition' }
  }
  return {
    ok: true,
    value: {
      category: raw.categorie,
      title: raw.titre.trim(),
      finding: raw.constat.trim(),
      proposal: raw.proposition.trim(),
      gain: raw.gain.trim(),
      risk: raw.risque,
      severity: raw.gravite,
      confidence: raw.confiance,
      evidence: { observations, code },
      files,
      withoutEvidence,
      dedupeKey: dedupeKeyOf(raw.categorie, files, raw.titre)
    }
  }
}

function merge(into: CheckedProposal, other: CheckedProposal): CheckedProposal {
  const keys = new Set(into.evidence.observations.map((item) => item.key))
  const places = new Set(into.evidence.code.map((item) => `${item.path}:${item.start ?? ''}`))
  return {
    ...into,
    evidence: {
      observations: [...into.evidence.observations, ...other.evidence.observations.filter((o) => !keys.has(o.key))],
      code: [...into.evidence.code, ...other.evidence.code.filter((c) => !places.has(`${c.path}:${c.start ?? ''}`))]
    },
    withoutEvidence: into.withoutEvidence && other.withoutEvidence
  }
}

/**
 * Vérifie, classe et plafonne. Une proposition qui échoue est écartée entière ; deux propositions de même catégorie et
 * mêmes fichiers sont fusionnées ; une proposition identique à une proposition ouverte est écartée (doublon) ; une
 * proposition identique à une proposition refusée n'est gardée que si elle cite un fait nouveau (FR-018).
 */
export function checkProposals(input: CheckInput): CheckResult {
  const rejected: { title: string; reason: RejectReason }[] = []
  const valid: CheckedProposal[] = []
  for (const raw of input.proposals) {
    const verdict = verify(raw, input)
    if (verdict.ok) valid.push(verdict.value)
    else rejected.push({ title: raw.titre, reason: verdict.reason })
  }
  valid.sort((a, b) => b.severity - a.severity || b.confidence - a.confidence)

  const merged: CheckedProposal[] = []
  for (const proposal of valid) {
    const index = merged.findIndex((item) => item.dedupeKey === proposal.dedupeKey)
    if (index === -1) merged.push(proposal)
    else merged[index] = merge(merged[index] as CheckedProposal, proposal)
  }

  const open = new Set(
    input.memory
      .filter((item) => (OPEN_STATUSES as readonly string[]).includes(item.status))
      .map((item) => item.dedupeKey)
  )
  const refused = new Map<string, Set<string>>()
  for (const item of input.memory) {
    if (item.status !== 'refused') continue
    const known = refused.get(item.dedupeKey) ?? new Set<string>()
    for (const signature of item.signatures) known.add(signature)
    refused.set(item.dedupeKey, known)
  }

  const kept: CheckedProposal[] = []
  for (const proposal of merged) {
    if (open.has(proposal.dedupeKey)) {
      rejected.push({ title: proposal.title, reason: 'duplicate' })
      continue
    }
    const known = refused.get(proposal.dedupeKey)
    if (known !== undefined && !proposal.evidence.observations.some((item) => !known.has(item.signature))) {
      rejected.push({ title: proposal.title, reason: 'refused_before' })
      continue
    }
    if (kept.length >= input.max) {
      rejected.push({ title: proposal.title, reason: 'over_limit' })
      continue
    }
    kept.push(proposal)
  }
  return { kept, rejected }
}
