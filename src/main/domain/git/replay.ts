/**
 * Rediffusion « qui a fait quoi » (spec 021 US5 lot 2, research R13) : lecture du journal avec les fichiers touchés, et
 * agrégation par nœud jusqu'à un commit. Poids `lines` (lignes ajoutées + supprimées, `--numstat`, dépôt complet) ou
 * `commits` (un commit compte 1 par nœud touché : clone partiel, D12). Purs.
 */

export type ReplayWeight = 'lines' | 'commits'

export interface ReplayChange {
  readonly path: string
  readonly weight: number
}

export interface ReplayLogCommit {
  readonly hash: string
  readonly email: string
  readonly name: string
  readonly date: string
  readonly changes: readonly ReplayChange[]
}

const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.+)$/s

/**
 * Sortie de `replayArgs` : un enregistrement par commit, ouvert par \x1e ; l'en-tête (`%H \x1f %an \x1f %ae \x1f %aI`)
 * finit au premier NUL, puis les fichiers séparés par NUL (`ajouts\tsuppressions\tchemin`, ou le chemin seul).
 * Fichier binaire (`-`) ou changement sans ligne : poids 1.
 */
export function parseReplayLog(output: string): ReplayLogCommit[] {
  const commits: ReplayLogCommit[] = []
  for (const record of output.split('\x1e')) {
    const end = record.indexOf('\0')
    if (end < 0) continue
    const [hash = '', name = '', email = '', date = ''] = record.slice(0, end).split('\x1f')
    if (!/^[0-9a-f]{40,64}$/.test(hash)) continue
    const changes: ReplayChange[] = []
    for (const raw of record.slice(end + 1).split('\0')) {
      const entry = raw.replace(/^\n+/, '')
      if (entry === '') continue
      const match = NUMSTAT.exec(entry)
      if (match === null) changes.push({ path: entry, weight: 1 })
      else {
        const lines = (Number(match[1]) || 0) + (Number(match[2]) || 0)
        changes.push({ path: match[3] ?? '', weight: Math.max(1, lines) })
      }
    }
    commits.push({ hash, name, email, date, changes })
  }
  return commits
}

export interface ReplayStep {
  readonly authorKey: string
  readonly changes: readonly ReplayChange[]
}

export interface NodeReplay {
  readonly key: string
  /** Auteur au plus fort poids sur ce nœud jusqu'au commit choisi. */
  readonly main: string
  /** Auteur du dernier commit qui a touché ce nœud. */
  readonly last: string
  /** Parts des auteurs (5 au plus, en %, arrondies), de la plus forte à la plus faible. */
  readonly shares: readonly { readonly authorKey: string; readonly percent: number }[]
}

/**
 * Nœuds touchés par les commits `steps[0..upto]` (du plus ancien au plus récent) : auteur principal, dernier auteur et
 * parts. `owner` attribue un chemin à un nœud visible (`null` : hors de la vue). Un nœud jamais touché est absent.
 */
export function replayNodes(
  steps: readonly ReplayStep[],
  upto: number,
  owner: (path: string) => string | null,
  weight: ReplayWeight
): NodeReplay[] {
  const totals = new Map<string, Map<string, number>>()
  const last = new Map<string, string>()
  const end = Math.min(upto, steps.length - 1)
  for (let index = 0; index <= end; index += 1) {
    const step = steps[index]
    if (step === undefined) continue
    const touched = new Map<string, number>()
    for (const change of step.changes) {
      const key = owner(change.path)
      if (key === null) continue
      touched.set(key, (touched.get(key) ?? 0) + change.weight)
    }
    for (const [key, lines] of touched) {
      const byAuthor = totals.get(key) ?? new Map<string, number>()
      byAuthor.set(step.authorKey, (byAuthor.get(step.authorKey) ?? 0) + (weight === 'lines' ? lines : 1))
      totals.set(key, byAuthor)
      last.set(key, step.authorKey)
    }
  }
  return [...totals].map(([key, byAuthor]) => {
    const sum = [...byAuthor.values()].reduce((total, value) => total + value, 0)
    const ranked = [...byAuthor].sort((a, b) => b[1] - a[1])
    return {
      key,
      main: ranked[0]?.[0] ?? '',
      last: last.get(key) ?? '',
      shares: ranked.slice(0, 5).map(([authorKey, value]) => ({ authorKey, percent: Math.round((value / sum) * 100) }))
    }
  })
}
