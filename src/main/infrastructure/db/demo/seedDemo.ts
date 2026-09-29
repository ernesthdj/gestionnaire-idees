import { like } from 'drizzle-orm'
import { linkFingerprint, orderedPair } from '../../../domain/neurons/links'
import type { AppDatabase } from '../client'
import {
  contextAssessments,
  extensions,
  linkSeeds,
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

/** Identifiants au format UUID (exigé par les canaux IPC), reconnaissables à leur préfixe `dea00000-`. */
export const DEMO_PREFIX = 'dea00000-'

const KIND = {
  root: 1,
  sub: 2,
  extension: 3,
  gauge: 4,
  synthesis: 5,
  task: 6,
  dependency: 7,
  summary: 8,
  link: 9,
  batch: 0xa,
  seed: 0xb
} as const

export function demoId(kind: keyof typeof KIND, n: number): string {
  return `${DEMO_PREFIX}000${KIND[kind].toString(16)}-4000-8000-${String(n).padStart(12, '0')}`
}

const DEMO_SEEDS = [
  { title: 'Graine fictive : regrouper les deux achats', why: 'Les deux idées visent le même budget (démo).' },
  { title: 'Graine fictive : un seul déplacement pour les deux', why: 'Même période, même lieu (démo).' },
  { title: 'Graine fictive : en faire un petit projet commun', why: 'Idées complémentaires (démo).' }
] as const

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
      const id = demoId('root', index)
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
            id: demoId('sub', index * 10 + n),
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
          id: demoId('extension', index),
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
          id: demoId('gauge', index),
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
      const synthesisId = demoId('synthesis', index)
      tx.insert(syntheses)
        .values({
          id: synthesisId,
          rootId,
          type: nature === 'action' ? 'action_plan' : 'reflection_summary',
          payloadJson: '{}',
          baseVersion: 1,
          status: 'confirmed',
          batchId: demoId('batch', index)
        })
        .run()
      // Sous-neurones de l'idée (sources des points de synthèse, visibles en plongée).
      const subs = ['budget : 250 €', 'échéance : ce mois-ci'].map((title, n) => {
        const id = demoId('sub', index * 10 + n)
        tx.insert(neurons)
          .values({ id, rootId, parentId: rootId, depth: 1, kind: 'answer', title, origin: 'user' })
          .run()
        return id
      })
      const task = (n: number): string => demoId('task', index * 10 + n)
      const node = (n: number, values: Omit<typeof planNodes.$inferInsert, 'id' | 'rootId' | 'synthesisId'>): void => {
        tx.insert(planNodes)
          .values({ id: task(n), rootId, synthesisId, ...values })
          .run()
      }
      const dependency = (
        n: number,
        from: number,
        to: number,
        kind: 'after_done' | 'on_trigger',
        triggerLabel: string | null = null
      ): void => {
        tx.insert(planDependencies)
          .values({
            id: demoId('dependency', index * 10 + n),
            fromNodeId: task(from),
            toNodeId: task(to),
            kind,
            triggerLabel
          })
          .run()
      }
      if (nature === 'action' && i % 4 === 0) {
        // Plan complet : condition à deux branches, dépendance, déclencheur et opportunité.
        node(0, { type: 'condition', title: 'J’ai le budget ?', question: 'Budget disponible ?', status: 'ready' })
        node(1, {
          type: 'task',
          title: 'Commander maintenant',
          parentId: task(0),
          branchLabel: 'Oui',
          amountCents: 25000,
          status: 'blocked'
        })
        node(2, {
          type: 'task',
          title: 'Attendre la mission payée',
          parentId: task(0),
          branchLabel: 'Non',
          status: 'blocked'
        })
        node(3, { type: 'task', title: 'Installer et tester', dueDate: '2026-10-31', status: 'blocked' })
        node(4, { type: 'task', title: 'Commander après la mission', status: 'blocked' })
        node(5, { type: 'opportunity', title: 'Revendre l’ancien matériel', amountCents: 8000, status: 'ready' })
        dependency(1, 1, 3, 'after_done')
        dependency(2, 2, 4, 'on_trigger', 'mission payée')
      } else if (nature === 'action') {
        const tasks = ['Comparer trois options', 'Réserver ou commander', 'Faire le point'] as const
        tasks.forEach((title, n) => node(n, { type: 'task', title, status: n === 0 ? 'ready' : 'blocked' }))
        for (let n = 1; n < tasks.length; n++) dependency(n, n - 1, n, 'after_done')
      } else {
        tx.insert(reflectionSummaries)
          .values({
            id: demoId('summary', index),
            rootId,
            synthesisId,
            keyPointsJson: JSON.stringify([{ text: 'Idée fictive de démonstration', sourceIds: [subs[0]] }]),
            decisionsJson: JSON.stringify([{ text: 'Essayer d’abord en petit', sourceIds: [subs[1]] }]),
            prosJson: JSON.stringify([{ text: 'Simple à essayer', sourceIds: subs }]),
            consJson: JSON.stringify([{ text: 'Demande un peu de temps', sourceIds: [] }]),
            openQuestionsJson: JSON.stringify([{ text: 'Quel budget ?' }])
          })
          .run()
      }
    }

    // Liens réalistes : comme dans l'app (liens proposés entre idées proches), des groupes de 5 idées reliées
    // (une chaîne + 2 raccourcis) et quelques ponts entre groupes. Les 20 % derniers restent suggérés.
    const pairs: [string, string][] = []
    const at = (k: number): string => hatchedIds[k] as string
    for (let group = 0; group + 5 <= hatchedIds.length; group += 5) {
      for (let k = 0; k < 4; k++) pairs.push([at(group + k), at(group + k + 1)])
      pairs.push([at(group), at(group + 2)], [at(group + 2), at(group + 4)])
    }
    for (let group = 5; group + 5 <= hatchedIds.length && pairs.length < size.links; group += 15) {
      pairs.push([at(group - 1), at(group)])
    }
    const kept = pairs.slice(0, size.links)
    kept.forEach(([first, second], index) => {
      const [a, b] = orderedPair(first, second)
      const label = pick(['même budget', 'même période', 'complémentaire', 'même lieu'], random)
      const suggested = index >= Math.floor(kept.length * 0.8)
      tx.insert(neuronLinks)
        .values({
          id: demoId('link', index + 1),
          aRootId: a,
          bRootId: b,
          label,
          justification: suggested ? 'Suggestion fictive de démonstration' : null,
          origin: suggested ? 'ai' : 'user',
          status: suggested ? 'suggested' : 'accepted',
          fingerprint: linkFingerprint(a, b, label)
        })
        .run()
    })
    // Graines en attente sur les 3 premiers liens acceptés (FR-028) : pour essayer « Faire naître » sans IA.
    DEMO_SEEDS.slice(0, Math.min(DEMO_SEEDS.length, Math.floor(kept.length * 0.8))).forEach((seed, index) => {
      tx.insert(linkSeeds)
        .values({ id: demoId('seed', index + 1), linkId: demoId('link', index + 1), ...seed, status: 'suggested' })
        .run()
    })
  })
  return { seeded: true }
}
