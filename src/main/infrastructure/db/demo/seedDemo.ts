import { like } from 'drizzle-orm'
import { linkFingerprint, orderedPair } from '../../../domain/neurons/links'
import type { AppDatabase } from '../client'
import {
  contextAssessments,
  extensions,
  neuronLinks,
  neurons,
  planDependencies,
  planNodes,
  reflectionSummaries,
  syntheses
} from '../schemaNeurons'

/**
 * Jeu de démonstration FICTIF (spec 003 T002) : 100 idées dans les 3 états et 50 liens, pour juger la fluidité
 * de l'écran Idées (SC-004). Déterministe (graine fixe) et inséré une seule fois, uniquement dans le profil démo.
 */

export const DEMO_PREFIX = 'demo-'

export interface DemoSize {
  readonly raw: number
  readonly developing: number
  readonly hatched: number
  readonly links: number
}

export const DEFAULT_DEMO_SIZE: DemoSize = { raw: 30, developing: 30, hatched: 40, links: 50 }

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
const pad = (n: number): string => String(n).padStart(3, '0')

/** Remplit la base avec le jeu fictif ; ne fait rien si des données de démonstration existent déjà. */
export function seedDemo(db: AppDatabase, size: DemoSize = DEFAULT_DEMO_SIZE): { seeded: boolean } {
  const existing = db
    .select({ id: neurons.id })
    .from(neurons)
    .where(like(neurons.id, `${DEMO_PREFIX}%`))
    .limit(1)
    .get()
  if (existing !== undefined) return { seeded: false }

  const random = seededRandom(20260928)
  const hatchedIds: string[] = []

  db.transaction((tx) => {
    const insertRoot = (
      index: number,
      state: 'raw' | 'developing' | 'hatched',
      nature: 'action' | 'reflection'
    ): string => {
      const id = `${DEMO_PREFIX}root-${pad(index)}`
      tx.insert(neurons)
        .values({
          id,
          rootId: id,
          kind: 'root',
          title: `${pick(VERBS, random)} ${pick(SUBJECTS, random)}`,
          content: null,
          origin: 'user',
          nature,
          natureSource: 'ai',
          categoryId: pick(CATEGORIES, random),
          categorySource: 'ai',
          state,
          version: state === 'raw' ? 0 : 2
        })
        .run()
      return id
    }

    let index = 0
    for (let i = 0; i < size.raw; i++) insertRoot(++index, 'raw', random() < 0.5 ? 'action' : 'reflection')

    for (let i = 0; i < size.developing; i++) {
      const rootId = insertRoot(++index, 'developing', random() < 0.5 ? 'action' : 'reflection')
      for (const [n, title] of ['Oui, dès que possible', 'Budget à définir'].entries()) {
        tx.insert(neurons)
          .values({
            id: `${rootId}-sub-${n}`,
            rootId,
            parentId: rootId,
            depth: 1,
            kind: 'answer',
            title,
            origin: 'user'
          })
          .run()
      }
      tx.insert(extensions)
        .values({
          id: `${rootId}-ext-0`,
          rootId,
          neuronId: rootId,
          question: 'Quelle échéance vises-tu ?',
          quickRepliesJson: JSON.stringify(['Ce mois-ci', 'Plus tard']),
          dimension: 'quand',
          status: 'proposed',
          origin: 'ai'
        })
        .run()
      tx.insert(contextAssessments)
        .values({
          id: `${rootId}-gauge`,
          rootId,
          level: 'insufficient',
          aiLevel: 'insufficient',
          coveredJson: JSON.stringify(['quoi', 'budget']),
          missingJson: JSON.stringify(['quand']),
          answeredCount: 2
        })
        .run()
    }

    for (let i = 0; i < size.hatched; i++) {
      const nature = i % 2 === 0 ? 'action' : 'reflection'
      const rootId = insertRoot(++index, 'hatched', nature)
      hatchedIds.push(rootId)
      const synthesisId = `${rootId}-synthesis`
      tx.insert(syntheses)
        .values({
          id: synthesisId,
          rootId,
          type: nature === 'action' ? 'action_plan' : 'reflection_summary',
          payloadJson: '{}',
          baseVersion: 1,
          status: 'confirmed',
          batchId: `${rootId}-batch`
        })
        .run()
      if (nature === 'action') {
        const tasks = ['Comparer trois options', 'Réserver ou commander', 'Faire le point'] as const
        tasks.forEach((title, n) => {
          tx.insert(planNodes)
            .values({
              id: `${rootId}-task-${n}`,
              rootId,
              synthesisId,
              type: 'task',
              title,
              status: n === 0 ? 'ready' : 'blocked'
            })
            .run()
        })
        for (let n = 1; n < tasks.length; n++) {
          tx.insert(planDependencies)
            .values({
              id: `${rootId}-dep-${n}`,
              fromNodeId: `${rootId}-task-${n - 1}`,
              toNodeId: `${rootId}-task-${n}`,
              kind: 'after_done'
            })
            .run()
        }
      } else {
        tx.insert(reflectionSummaries)
          .values({
            id: `${rootId}-summary`,
            rootId,
            synthesisId,
            keyPointsJson: JSON.stringify(['Idée fictive de démonstration']),
            decisionsJson: '[]',
            prosJson: JSON.stringify(['Simple à essayer']),
            consJson: '[]',
            openQuestionsJson: JSON.stringify(['Quel budget ?'])
          })
          .run()
      }
    }

    // Liens entre idées écloses : paires distinctes, les 20 % derniers restent suggérés (à valider).
    const seen = new Set<string>()
    const maxLinks = Math.min(size.links, (hatchedIds.length * (hatchedIds.length - 1)) / 2)
    let linkIndex = 0
    while (linkIndex < maxLinks) {
      const [a, b] = orderedPair(pick(hatchedIds, random), pick(hatchedIds, random))
      if (a === b || seen.has(`${a}|${b}`)) continue
      seen.add(`${a}|${b}`)
      const label = pick(['même budget', 'même période', 'complémentaire', 'même lieu'], random)
      const suggested = linkIndex >= Math.floor(size.links * 0.8)
      tx.insert(neuronLinks)
        .values({
          id: `${DEMO_PREFIX}link-${pad(++linkIndex)}`,
          aRootId: a,
          bRootId: b,
          label,
          justification: suggested ? 'Suggestion fictive de démonstration' : null,
          origin: suggested ? 'ai' : 'user',
          status: suggested ? 'suggested' : 'accepted',
          fingerprint: linkFingerprint(a, b, label)
        })
        .run()
    }
  })
  return { seeded: true }
}
