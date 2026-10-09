import { eq, like } from 'drizzle-orm'
import type { Sheet } from '../../../domain/conversation/sheet'
import type { AppDatabase } from '../client'
import { contextAssessments, mapLinks, neurons } from '../schemaNeurons'

/**
 * Jeu de démonstration FICTIF (spec 003 T002, réécrit par la spec 010 C3, réduit par la spec 022) : deux genesis
 * éclos, posés loin l'un de l'autre — le premier porte un plan d'attaque à trois niveaux, le second une carte de
 * structure de projet. Déterministe (graine fixe), inséré une seule fois, uniquement dans le profil démo. Aucune donnée
 * de l'ancien moteur. `DemoSize` permet encore un jeu plus fourni (tests). Avec `projectDir`, le second genesis est lié
 * à un dossier de méthode fictif (spec 023 T039) : la bascule « Workflow » y montre specs, tâches et brainstorm.
 */

/** Identifiants au format UUID (exigé par les canaux IPC), reconnaissables à leur préfixe `dea00000-`. */
export const DEMO_PREFIX = 'dea00000-'

const KIND = { root: 1, step: 5, gauge: 4, link: 9, element: 0xc } as const

export function demoId(kind: keyof typeof KIND, n: number): string {
  return `${DEMO_PREFIX}000${KIND[kind].toString(16)}-4000-8000-${String(n).padStart(12, '0')}`
}

/** Maturités des idées travaillées : tous les paliers de taille sont représentés. */
const LEVELS = ['insufficient', 'sufficient', 'complete'] as const

export interface DemoSize {
  readonly raw: number
  readonly developing: number
  readonly hatched: number
  readonly links: number
}

export const DEFAULT_DEMO_SIZE: DemoSize = { raw: 0, developing: 0, hatched: 2, links: 0 }

/** Titres et places fixes des deux genesis de la démo (plan, puis carte de structure) : leurs arbres ne se touchent pas. */
const DEMO_GENESIS = [
  { title: 'Planifier le portfolio en ligne', position: { x: 0, y: 0 } },
  { title: 'Projet démo : application de notes', position: { x: 1400, y: 0 } }
] as const

const CATEGORIES = ['cat-general', 'cat-achat', 'cat-projet', 'cat-sortie', 'cat-photo', 'cat-it'] as const
const SUBJECTS = [
  'un deuxième écran',
  'un sac photo',
  'le portfolio en ligne',
  'une sortie au lac',
  'un atelier cuisine',
  'la refonte du blog',
  'un objectif lumineux',
  'un week-end à la mer',
  'un script de sauvegarde',
  'un carnet de voyage',
  'une série de portraits',
  'un tableau de bord budget'
] as const
const VERBS = ['Acheter', 'Organiser', 'Explorer', 'Préparer', 'Tester', 'Planifier', 'Comparer', 'Imaginer'] as const

/** Fiche fictive d'une idée travaillée : plus elle est mûre, plus elle est remplie. */
function demoSheet(level: (typeof LEVELS)[number]): Sheet {
  const complete = level === 'complete'
  return {
    resume: 'Idée fictive de démonstration : on veut avancer sans trop dépenser.',
    points_cles: ['Budget fictif : 250 €', ...(level === 'insufficient' ? [] : ['Échéance : ce mois-ci'])],
    decisions: complete ? ['Essayer d’abord en petit'] : [],
    questions_ouvertes: complete ? [] : ['Quel budget exact ?'],
    manques: level === 'insufficient' ? ['L’échéance', 'Le budget exact'] : []
  }
}

/** Carte de structure fictive du dernier genesis (spec 009) : modules, composants, tâche et liens typés. */
const DEMO_STRUCTURE = [
  { key: 'module:app', type: 'module', title: 'Application', parent: null, status: 'en_cours' },
  { key: 'module:donnees', type: 'module', title: 'Données', parent: null, status: 'livree' },
  { key: 'composant:ecran', type: 'composant', title: 'Écran principal', parent: 'module:app', status: 'en_cours' },
  { key: 'composant:reglages', type: 'composant', title: 'Réglages', parent: 'module:app', status: 'idee' },
  { key: 'donnee:base', type: 'donnee', title: 'Base locale', parent: 'module:donnees', status: 'livree' },
  { key: 'tache:sauvegarde', type: 'tache', title: 'Sauvegarde nocturne', parent: 'module:donnees', status: 'a_faire' }
] as const
const DEMO_RELATIONS = [
  { from: 'composant:ecran', to: 'donnee:base', relation: 'lit_ecrit' },
  { from: 'tache:sauvegarde', to: 'donnee:base', relation: 'depend_de' }
] as const

/**
 * Plan d'attaque fictif du premier genesis éclos (spec 011, montré en sens alterné par la spec 022) : trois étapes,
 * des sous-étapes et un troisième niveau, à tous les statuts.
 */
type DemoStep = readonly [
  title: string,
  status: 'a_faire' | 'en_cours' | 'fait' | 'bloque',
  children?: readonly DemoStep[]
]
const DEMO_PLAN: readonly DemoStep[] = [
  [
    'Choisir l’hébergeur',
    'fait',
    [
      ['Comparer trois offres', 'fait'],
      ['Réserver le nom de domaine', 'fait']
    ]
  ],
  [
    'Rédiger les textes',
    'en_cours',
    [
      [
        'Présentation',
        'en_cours',
        [
          ['Version courte', 'a_faire'],
          ['Version longue', 'a_faire']
        ]
      ],
      ['Mentions légales', 'a_faire']
    ]
  ],
  [
    'Sélectionner vingt photos',
    'a_faire',
    [
      ['Trier par série', 'a_faire'],
      ['Retouches légères', 'bloque']
    ]
  ]
]

/** Générateur pseudo-aléatoire à graine (mulberry32) : même jeu de données à chaque exécution. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)] as T

/** Remplit la base avec le jeu fictif ; ne fait rien si des données de démonstration existent déjà. */
export function seedDemo(
  db: AppDatabase,
  size: DemoSize = DEFAULT_DEMO_SIZE,
  options: { readonly projectDir?: string } = {}
): { seeded: boolean } {
  const existing = db
    .select({ id: neurons.id })
    .from(neurons)
    .where(like(neurons.id, `${DEMO_PREFIX}%`))
    .limit(1)
    .get()
  if (existing !== undefined) return { seeded: false }

  const random = seededRandom(20260928)
  const allIds: string[] = []

  db.transaction((tx) => {
    let hatchedCount = 0
    const insertRoot = (index: number, state: 'raw' | 'developing' | 'hatched'): string => {
      const id = demoId('root', index)
      const level = state === 'raw' ? null : state === 'hatched' ? 'complete' : (LEVELS[index % LEVELS.length] ?? null)
      // Les deux premiers genesis éclos ont un titre et une place fixes (le plan, puis la carte de structure).
      const fixed = state === 'hatched' ? DEMO_GENESIS[hatchedCount++] : undefined
      tx.insert(neurons)
        .values({
          id,
          rootId: id,
          kind: 'root',
          title: fixed?.title ?? `${pick(VERBS, random)} ${pick(SUBJECTS, random)}`,
          ...(fixed === undefined ? {} : { posX: fixed.position.x, posY: fixed.position.y, pinned: true }),
          content: null,
          origin: 'user',
          nature: random() < 0.5 ? 'action' : 'reflection',
          natureSource: 'ai',
          categoryId: pick(CATEGORIES, random),
          categorySource: 'ai',
          state,
          version: state === 'raw' ? 0 : 2,
          sheetJson: level === null ? null : JSON.stringify(demoSheet(level))
        })
        .run()
      if (level !== null) {
        tx.insert(contextAssessments)
          .values({
            id: demoId('gauge', index),
            rootId: id,
            level,
            aiLevel: level,
            coveredJson: '[]',
            missingJson: JSON.stringify(demoSheet(level).manques),
            answeredCount: 0
          })
          .run()
      }
      allIds.push(id)
      return id
    }

    let index = 0
    for (let i = 0; i < size.raw; i++) insertRoot(++index, 'raw')
    for (let i = 0; i < size.developing; i++) insertRoot(++index, 'developing')
    for (let i = 0; i < size.hatched; i++) insertRoot(++index, 'hatched')

    // Liens libres entre idées de tous états (espace unique, FR-029) : de petites chaînes (idées prises de 3 en 3).
    const pairs: [string, string][] = []
    for (let offset = 0; offset < 3; offset++) {
      const chain = allIds.filter((_, k) => k % 3 === offset)
      for (let k = 0; k + 1 < chain.length; k++) pairs.push([chain[k] as string, chain[k + 1] as string])
    }
    pairs.slice(0, size.links).forEach(([from, to], n) => {
      tx.insert(mapLinks)
        .values({
          id: demoId('link', n + 1),
          fromKind: 'idea',
          fromId: from,
          toKind: 'idea',
          toId: to,
          label: pick(['même budget', 'même période', 'complémentaire', 'même lieu'], random),
          origin: 'user'
        })
        .run()
    })

    // Plan d'attaque du premier genesis éclos.
    const planned = allIds[size.raw + size.developing]
    if (planned !== undefined) {
      let stepIndex = 0
      const insertSteps = (parentId: string, steps: readonly DemoStep[], depth: number): void =>
        steps.forEach(([title, status, children], rank) => {
          const id = demoId('step', ++stepIndex)
          tx.insert(neurons)
            .values({
              id,
              rootId: planned,
              parentId,
              depth,
              kind: 'step',
              state: 'raw',
              title,
              origin: 'claude',
              genesisId: planned,
              rank: rank + 1,
              stepStatus: status
            })
            .run()
          if (children !== undefined) insertSteps(id, children, depth + 1)
        })
      insertSteps(planned, DEMO_PLAN, 1)
    }

    // Carte de structure du dernier genesis, lié au dossier de méthode fictif s'il est fourni.
    const genesisId = allIds.at(-1)
    if (genesisId === undefined) return
    if (options.projectDir !== undefined) {
      tx.update(neurons).set({ projectDir: options.projectDir }).where(eq(neurons.id, genesisId)).run()
    }
    const elementIds = new Map(DEMO_STRUCTURE.map((element, n) => [element.key, demoId('element', n + 1)] as const))
    DEMO_STRUCTURE.forEach((element) => {
      const parentId = element.parent === null ? genesisId : (elementIds.get(element.parent) ?? genesisId)
      const id = elementIds.get(element.key) ?? ''
      tx.insert(neurons)
        .values({
          id,
          rootId: genesisId,
          parentId,
          depth: element.parent === null ? 1 : 2,
          kind: 'element',
          state: 'raw',
          title: element.title,
          origin: 'claude',
          genesisId,
          elementType: element.type,
          elementKey: element.key,
          elementStatus: element.status,
          pathsJson: '[]',
          collapsed: false
        })
        .run()
    })
    DEMO_RELATIONS.forEach((link, n) => {
      tx.insert(mapLinks)
        .values({
          id: demoId('link', 1000 + n),
          fromKind: 'element',
          fromId: elementIds.get(link.from) ?? '',
          toKind: 'element',
          toId: elementIds.get(link.to) ?? '',
          label: null,
          relation: link.relation,
          origin: 'claude'
        })
        .run()
    })
  })
  return { seeded: true }
}
