import { ARCHITECTURES, isViolation, type ArchitectureKind } from './architecture'

/**
 * Détecteur d'architecture (spec 032 D15) : l'architecture reconnue d'un projet repris, par des règles sur les noms de
 * ses dossiers et le sens de ses appels, avec sa raison en une phrase. Sans IA ; Claude peut la préciser, mentalyas la
 * corrige (sa correction prime). Pur, partagé par le main et l'interface.
 */

export interface DetectInput {
  /** Chemins relatifs des fichiers du code. */
  readonly paths: readonly string[]
  /** Appels de fichier à fichier (chemins relatifs). */
  readonly calls: readonly { readonly from: string; readonly to: string }[]
}

export interface DetectedArchitecture {
  readonly kind: ArchitectureKind
  /** Une phrase : ce qui l'a fait reconnaître (dossiers, sens des appels). */
  readonly reason: string
  /** Appels qui sortent du cœur vers l'extérieur (règle de dépendance de la spec 017 D20). */
  readonly violations: number
}

/** Une règle : des dossiers signatures, et combien de groupes distincts il en faut. */
interface Rule {
  readonly kind: Exclude<ArchitectureKind, 'aucune'>
  /** Chaque groupe est un rôle ; un dossier du groupe suffit à le trouver. */
  readonly groups: readonly (readonly string[])[]
  readonly needed: number
}

/** Dans l'ordre : la plus spécifique d'abord (un dossier `ports` dit plus qu'un dossier `domain`). */
const RULES: readonly Rule[] = [
  { kind: 'hexagonale', groups: [['ports'], ['adapters', 'adaptateurs']], needed: 1 },
  { kind: 'mvvm', groups: [['viewmodels', 'viewmodel']], needed: 1 },
  {
    kind: 'clean',
    groups: [
      ['domain', 'domaine', 'core', 'entities'],
      ['application', 'usecases', 'use-cases', 'use_cases'],
      ['infrastructure', 'infra', 'persistence']
    ],
    needed: 2
  },
  {
    kind: 'mvc',
    groups: [
      ['controllers', 'controller'],
      ['models', 'model'],
      ['views', 'view']
    ],
    needed: 2
  },
  {
    kind: 'couches',
    groups: [
      ['presentation', 'ui', 'web'],
      ['business', 'metier', 'logic', 'services'],
      ['data', 'dal', 'repositories', 'database']
    ],
    needed: 2
  }
]

const MAX_NAMES = 3

/** Noms de dossiers (en minuscules) de tous les chemins, sans le nom de fichier. */
function folderNames(paths: readonly string[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>()
  for (const path of paths) {
    const segments = path.replace(/\\/g, '/').split('/').slice(0, -1)
    for (const segment of segments) {
      const lower = segment.toLowerCase()
      if (!names.has(lower)) names.set(lower, segment)
    }
  }
  return names
}

/** Couche d'un fichier pour une architecture : le dossier le plus profond qui en nomme une. */
function layerOfPath(kind: ArchitectureKind, path: string): string | null {
  let found: string | null = null
  for (const segment of path.toLowerCase().replace(/\\/g, '/').split('/').slice(0, -1)) {
    const match = ARCHITECTURES[kind].layers.find((entry) => entry.folders.includes(segment))
    if (match !== undefined) found = match.id
  }
  return found
}

const quoted = (names: readonly string[]): string => {
  const shown = names.slice(0, MAX_NAMES).map((name) => `« ${name} »`)
  if (shown.length < 2) return shown.join('')
  return `${shown.slice(0, -1).join(', ')} et ${shown.at(-1) ?? ''}`
}

const plural = (count: number, word: string): string => `${count} ${word}${count > 1 ? 's' : ''}`

export function detectArchitecture(input: DetectInput): DetectedArchitecture {
  const names = folderNames(input.paths)
  for (const rule of RULES) {
    const found = rule.groups.flatMap((group) => {
      const hit = group.find((name) => names.has(name))
      return hit === undefined ? [] : [names.get(hit) ?? hit]
    })
    if (found.length < rule.needed) continue
    let crossing = 0
    let violations = 0
    for (const call of input.calls) {
      const from = layerOfPath(rule.kind, call.from)
      const to = layerOfPath(rule.kind, call.to)
      if (from === null || to === null || from === to) continue
      crossing += 1
      if (isViolation(rule.kind, from, to)) violations += 1
    }
    const folders = `${found.length > 1 ? 'Dossiers' : 'Dossier'} ${quoted(found)}`
    const direction =
      crossing === 0
        ? 'aucun appel entre couches'
        : violations === 0
          ? 'les appels vont vers le cœur'
          : `${plural(violations, 'appel')} ${violations > 1 ? 'sortent' : 'sort'} du cœur vers l’extérieur`
    return { kind: rule.kind, reason: `${folders} ; ${direction}.`, violations }
  }
  return {
    kind: 'aucune',
    reason: 'Aucun dossier ne nomme de couche connue (domaine, contrôleurs, ports…).',
    violations: 0
  }
}
