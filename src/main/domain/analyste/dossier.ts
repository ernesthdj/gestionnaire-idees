import type { AggregateEntry, AggregateType } from './aggregate'

/**
 * Dossier d'analyse (spec 019 FR-013, `L3-analyste-analyse.md` §3) : le seul texte que l'Analyste reçoit. Balisé,
 * borné, construit par l'app à partir d'agrégats sans contenu, de l'analyse statique du dépôt (spec 017) et de la
 * mémoire des propositions. Tout texte variable est échappé : rien ne peut fermer une balise ni en ouvrir une.
 */

export const DOSSIER_VERSION = 1
/** Taille maximale du dossier (caractères). */
export const DOSSIER_LIMIT = 40_000

/** Ordre de priorité quand le dossier déborde (`L3-analyste-analyse.md` §8). */
const PRIORITY: readonly AggregateType[] = ['err', 'lent', 'ia', 'aller', 'seq', 'inutil', 'compte']

const BUDGET = { code: 12_000, memory: 6_000 } as const

/** Résumé de l'analyse statique du dépôt (graphe de la spec 017), sans code source. */
export interface CodeSummary {
  readonly files: number
  readonly modules: readonly { readonly key: string; readonly rootPath: string; readonly files: number }[]
  readonly entryPoints: number
  /** Fonctions et méthodes sans appel entrant résolu, hors points d'entrée : candidats au code mort. */
  readonly uncalled: readonly { readonly path: string; readonly name: string; readonly line: number }[]
}

/** Souvenir d'une proposition antérieure (≤ 30, FR-018). */
export interface MemoryItem {
  readonly category: string
  readonly title: string
  readonly status: string
  readonly refusalReason: string | null
  readonly files: readonly string[]
}

export interface DossierInput {
  readonly window: { readonly from: number; readonly to: number; readonly events: number }
  readonly entries: readonly AggregateEntry[]
  readonly code: CodeSummary | null
  readonly memory: readonly MemoryItem[]
}

export interface Dossier {
  readonly text: string
  /** Agrégats réellement envoyés : seules leurs clés peuvent être citées (FR-016). */
  readonly entries: ReadonlyMap<string, AggregateEntry>
}

/** Échappe un texte variable : aucune balise ne peut être ouverte ou fermée par une donnée. */
export function escapeDossierText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\r\n]+/g, ' ')
}

const iso = (ms: number): string => new Date(ms).toISOString()

/** Lignes ajoutées tant qu'elles tiennent dans le budget ; le reste est compté. */
function fit(lines: readonly string[], budget: number): { text: string[]; omitted: number } {
  const kept: string[] = []
  let used = 0
  for (const line of lines) {
    if (used + line.length + 1 > budget) break
    kept.push(line)
    used += line.length + 1
  }
  return { text: kept, omitted: lines.length - kept.length }
}

function codeSection(code: CodeSummary | null): string[] {
  if (code === null) {
    return ['  (aucune analyse statique du dépôt disponible : lis le code avec tes outils au besoin)']
  }
  const lines = [
    `  fichiers=${code.files} modules=${code.modules.length} points_d_entree=${code.entryPoints}`,
    ...code.modules.map(
      (m) => `  module ${escapeDossierText(m.key)} racine=${escapeDossierText(m.rootPath || '.')} fichiers=${m.files}`
    ),
    `  fonctions sans appel entrant résolu (candidats, à vérifier en lisant le code) : ${code.uncalled.length}`,
    ...code.uncalled.map((u) => `  - ${escapeDossierText(u.path)}:${u.line} ${escapeDossierText(u.name)}`)
  ]
  const { text, omitted } = fit(lines, BUDGET.code)
  return omitted === 0 ? text : [...text, `  … ${omitted} lignes omises`]
}

function memorySection(memory: readonly MemoryItem[]): string[] {
  if (memory.length === 0) return ['  (aucune proposition antérieure)']
  const lines = memory.map((item) => {
    const reason = item.refusalReason === null ? '' : ` raison_du_refus="${escapeDossierText(item.refusalReason)}"`
    const files = item.files.length === 0 ? '' : ` fichiers=${item.files.map(escapeDossierText).join(',')}`
    return `  - [${escapeDossierText(item.category)}] « ${escapeDossierText(item.title)} » statut=${escapeDossierText(item.status)}${reason}${files}`
  })
  const { text, omitted } = fit(lines, BUDGET.memory)
  return omitted === 0 ? text : [...text, `  … ${omitted} propositions omises`]
}

/**
 * Construit le dossier. Ordre des sections : observations, code, mémoire ; le code et la mémoire ont un budget propre,
 * les observations prennent la place restante par priorité (erreurs > lenteurs > IA > parcours > inutilisés >
 * comptages). Un agrégat qui ne tient pas n'est pas envoyé et ne peut donc pas être cité.
 */
export function buildDossier(input: DossierInput): Dossier {
  const head = `<dossier version="${DOSSIER_VERSION}">\n  <fenetre debut="${iso(input.window.from)}" fin="${iso(input.window.to)}" evenements="${input.window.events}" />`
  const code = ['  <code>', ...codeSection(input.code), '  </code>'].join('\n')
  const memory = ['  <memoire>', ...memorySection(input.memory), '  </memoire>'].join('\n')
  const tail = '</dossier>'
  const fixed =
    head.length + code.length + memory.length + tail.length + '  <observations>\n  </observations>'.length + 8
  let room = DOSSIER_LIMIT - fixed - 40

  const ordered = PRIORITY.flatMap((type) => input.entries.filter((entry) => entry.type === type))
  const sent = new Map<string, AggregateEntry>()
  const lines: string[] = []
  let omitted = 0
  for (const entry of ordered) {
    const line = `    ${entry.key} ${escapeDossierText(entry.line)}`
    if (line.length + 1 > room) {
      omitted += 1
      continue
    }
    lines.push(line)
    sent.set(entry.key, entry)
    room -= line.length + 1
  }
  const observations = [
    '  <observations>',
    ...(lines.length === 0 ? ['    (aucun agrégat sur la période)'] : lines),
    ...(omitted === 0 ? [] : [`    … ${omitted} agrégats omis (dossier borné)`]),
    '  </observations>'
  ].join('\n')
  const text = [head, observations, code, memory, tail].join('\n')
  return { text: text.slice(0, DOSSIER_LIMIT), entries: sent }
}
