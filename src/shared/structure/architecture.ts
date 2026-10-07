/**
 * Architectures reconnues d'une carte de structure (spec 017 D20) : chacune est une liste de couches, de l'extérieur
 * vers le cœur, avec leur profondeur. Une seule règle de dépendance pour toutes : un lien d'une couche plus profonde
 * vers une couche moins profonde est une violation. Fonctions pures, partagées par le main et l'interface.
 */

export const ARCHITECTURE_KINDS = ['clean', 'hexagonale', 'mvvm', 'mvc', 'couches', 'aucune'] as const
export type ArchitectureKind = (typeof ARCHITECTURE_KINDS)[number]

export interface ArchitectureLayer {
  readonly id: string
  readonly label: string
  /** 1 = extérieur ; plus le nombre est grand, plus la couche est proche du cœur métier. */
  readonly depth: number
  /** Mots de dossier qui désignent cette couche (déduction par défaut, en minuscules). */
  readonly folders: readonly string[]
}

export interface ArchitectureDefinition {
  readonly kind: ArchitectureKind
  readonly label: string
  /** Couches dans l'ordre d'affichage des bandes (haut → bas). */
  readonly layers: readonly ArchitectureLayer[]
}

const layer = (id: string, label: string, depth: number, folders: readonly string[]): ArchitectureLayer => ({
  id,
  label,
  depth,
  folders
})

export const ARCHITECTURES: Readonly<Record<ArchitectureKind, ArchitectureDefinition>> = {
  clean: {
    kind: 'clean',
    label: 'Clean Architecture',
    layers: [
      layer('presentation', 'Présentation', 1, [
        'presentation',
        'ui',
        'renderer',
        'views',
        'pages',
        'components',
        'web'
      ]),
      layer('infrastructure', 'Infrastructure', 1, [
        'infrastructure',
        'infra',
        'persistence',
        'database',
        'db',
        'repositories',
        'adapters',
        'gateways'
      ]),
      layer('application', 'Application', 2, ['application', 'usecases', 'use-cases', 'use_cases', 'services']),
      layer('domaine', 'Domaine', 3, ['domain', 'domaine', 'entities', 'core'])
    ]
  },
  hexagonale: {
    kind: 'hexagonale',
    label: 'Architecture hexagonale',
    layers: [
      layer('entrants', 'Adaptateurs entrants', 1, ['in', 'inbound', 'primary', 'api', 'controllers', 'cli', 'ui']),
      layer('sortants', 'Adaptateurs sortants', 1, [
        'out',
        'outbound',
        'secondary',
        'persistence',
        'repositories',
        'infrastructure'
      ]),
      layer('application', 'Application (ports)', 2, ['application', 'ports', 'usecases', 'use-cases']),
      layer('domaine', 'Domaine', 3, ['domain', 'domaine', 'core', 'model'])
    ]
  },
  mvvm: {
    kind: 'mvvm',
    label: 'MVVM',
    layers: [
      layer('vue', 'Vue', 1, ['views', 'view', 'pages', 'components', 'ui']),
      layer('viewmodel', 'ViewModel', 2, ['viewmodels', 'viewmodel', 'vm']),
      layer('modele', 'Modèle', 3, ['models', 'model', 'entities', 'data'])
    ]
  },
  mvc: {
    kind: 'mvc',
    label: 'MVC',
    layers: [
      layer('vue', 'Vue', 1, ['views', 'view', 'templates', 'resources']),
      layer('controleur', 'Contrôleur', 1, ['controllers', 'controller', 'http']),
      layer('modele', 'Modèle', 2, ['models', 'model', 'entities'])
    ]
  },
  couches: {
    kind: 'couches',
    label: 'Architecture en couches',
    layers: [
      layer('presentation', 'Présentation', 1, ['presentation', 'ui', 'views', 'web', 'pages']),
      layer('metier', 'Métier', 2, ['business', 'metier', 'services', 'domain', 'logic']),
      layer('donnees', 'Données', 3, ['data', 'dal', 'repositories', 'persistence', 'db', 'database'])
    ]
  },
  aucune: { kind: 'aucune', label: 'Aucune architecture reconnue', layers: [] }
}

export const isArchitectureKind = (value: string): value is ArchitectureKind =>
  (ARCHITECTURE_KINDS as readonly string[]).includes(value)

export function layerOf(kind: ArchitectureKind, layerId: string | null): ArchitectureLayer | null {
  if (layerId === null) return null
  return ARCHITECTURES[kind].layers.find((entry) => entry.id === layerId) ?? null
}

/**
 * Couche déduite des chemins d'un élément (repère par défaut quand Claude n'en a pas donné) : pour chaque chemin, le
 * dossier le plus profond qui nomme une couche ; la couche la plus fréquente l'emporte, `null` en cas d'égalité ou
 * sans indice.
 */
export function inferLayer(kind: ArchitectureKind, paths: readonly string[]): string | null {
  const layers = ARCHITECTURES[kind].layers
  if (layers.length === 0) return null
  const votes = new Map<string, number>()
  for (const path of paths) {
    const segments = path.toLowerCase().replace(/\\/g, '/').split('/').filter(Boolean)
    let found: string | null = null
    for (const segment of segments) {
      const name = segment.replace(/\.[a-z0-9]+$/, '')
      const match = layers.find((entry) => entry.folders.includes(name))
      if (match !== undefined) found = match.id
    }
    if (found !== null) votes.set(found, (votes.get(found) ?? 0) + 1)
  }
  const ranked = [...votes].sort((a, b) => b[1] - a[1])
  const [first, second] = ranked
  if (first === undefined || (second !== undefined && second[1] === first[1])) return null
  return first[0]
}

/** Relations qui expriment une dépendance (`teste` et `bloque` n'en sont pas). */
export const DEPENDENCY_RELATIONS: ReadonlySet<string> = new Set(['depend_de', 'appelle', 'lit_ecrit', 'implemente'])

/** Le lien de `fromLayer` vers `toLayer` sort-il du cœur vers l'extérieur ? Inconnu ou non classé : pas de violation. */
export function isViolation(kind: ArchitectureKind, fromLayer: string | null, toLayer: string | null): boolean {
  const from = layerOf(kind, fromLayer)
  const to = layerOf(kind, toLayer)
  return from !== null && to !== null && from.depth > to.depth
}
