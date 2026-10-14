import type { ExplorerMapView, LinkProvenance, MapCallSentence, MapFileView } from '@shared/ipc/reprise'
import { weakestProvenance } from '@shared/ipc/reprise'

/** Un voisin d'une fiche (spec 031 D8) : le module ou le fichier à l'autre bout, et les appels en mots. */
export interface SheetLink {
  /** Clé du voisin (`m:…` ou `f:…`). */
  readonly key: string
  readonly title: string
  readonly count: number
  readonly provenance: LinkProvenance
  readonly sentences: readonly MapCallSentence[]
}

export interface Sheet {
  /** Ce qu'il appelle, du plus sollicité au moins sollicité. */
  readonly uses: readonly SheetLink[]
  /** Qui l'appelle. */
  readonly usedBy: readonly SheetLink[]
}

/** Phrases gardées par voisin : assez pour lire, pas tout le projet. */
const SENTENCES_PER_LINK = 4

interface Growing {
  readonly key: string
  readonly title: string
  count: number
  provenance: LinkProvenance
  readonly sentences: MapCallSentence[]
}

/** Regroupe les appels qui partent de `self` ou y arrivent par voisin (`end` : le voisin d'une extrémité de fichier). */
function sheetOf(map: ExplorerMapView, self: string, end: (fileKey: string) => string | null): Sheet {
  const titles = new Map<string, string>([
    ...map.modules.map((module) => [module.key, module.title] as const),
    ...map.files.map((file) => [file.key, file.title] as const)
  ])
  const uses = new Map<string, Growing>()
  const usedBy = new Map<string, Growing>()
  for (const call of map.calls) {
    const from = end(call.from)
    const to = end(call.to)
    if (from === null || to === null || from === to) continue
    const side = from === self ? uses : to === self ? usedBy : null
    const other = from === self ? to : from
    if (side === null) continue
    const link = side.get(other) ?? {
      key: other,
      title: titles.get(other) ?? other.slice(2),
      count: 0,
      provenance: call.provenance,
      sentences: []
    }
    link.count += call.count
    link.provenance = weakestProvenance(link.provenance, call.provenance)
    for (const sentence of call.sentences) if (link.sentences.length < SENTENCES_PER_LINK) link.sentences.push(sentence)
    side.set(other, link)
  }
  const sorted = (links: Map<string, SheetLink>): SheetLink[] =>
    [...links.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
  return { uses: sorted(uses), usedBy: sorted(usedBy) }
}

/** Fiche d'un module : les modules qu'il utilise et ceux qui l'utilisent (les appels internes ne comptent pas). */
export function moduleSheet(map: ExplorerMapView, moduleKey: string): Sheet {
  const moduleOf = new Map(map.files.map((file) => [file.key, file.moduleKey] as const))
  return sheetOf(map, moduleKey, (fileKey) => moduleOf.get(fileKey) ?? null)
}

/** Fiche d'un fichier : les fichiers qu'il appelle et ceux qui l'appellent, dans son module ou ailleurs. */
export function fileSheet(map: ExplorerMapView, fileKey: string): Sheet {
  return sheetOf(map, fileKey, (key) => key)
}

/** Un résultat de la recherche Ctrl+K (D9) : un fichier, ou une fonction dans son fichier. */
export interface SearchHit {
  readonly file: MapFileView
  /** Nom de la fonction trouvée ; `null` : le fichier lui-même. */
  readonly fn: string | null
}

/** Minuscules, sans accents : « Résumé » se trouve avec « resume ». */
const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** 0 : nom exact, 1 : début du nom, 2 : dans le nom, 3 : dans le chemin ; `null` : rien. */
function rankOf(name: string, query: string, path?: string): number | null {
  const folded = fold(name)
  if (folded === query) return 0
  if (folded.startsWith(query)) return 1
  if (folded.includes(query)) return 2
  if (path !== undefined && fold(path).includes(query)) return 3
  return null
}

/**
 * Recherche dans la carte (spec 031 D9) : les fichiers par leur nom ou leur chemin, les fonctions par leur nom, où
 * qu'ils soient ; le plus proche d'abord (nom exact, début, milieu, chemin), puis le nom le plus court.
 */
export function searchMap(map: ExplorerMapView, query: string, limit = 30): SearchHit[] {
  const wanted = fold(query.trim())
  if (wanted.length === 0) return []
  const hits: { readonly hit: SearchHit; readonly rank: number; readonly name: string }[] = []
  for (const file of map.files) {
    const rank = rankOf(file.title, wanted, file.path)
    if (rank !== null) hits.push({ hit: { file, fn: null }, rank, name: file.title })
    for (const fn of file.functions) {
      const found = rankOf(fn, wanted)
      if (found !== null) hits.push({ hit: { file, fn }, rank: found, name: fn })
    }
  }
  return hits
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.name.length - b.name.length ||
        a.name.localeCompare(b.name) ||
        a.hit.file.path.localeCompare(b.hit.file.path)
    )
    .slice(0, limit)
    .map((entry) => entry.hit)
}
