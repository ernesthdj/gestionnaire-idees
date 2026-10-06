import type { HatchedResultView } from '@shared/ipc/neurons'
import type { DocumentData, IdeaPart, PlanStepData, SheetData, StepPart, WidgetInputData } from '@shared/ipc/widgetIo'
import type { StepStatus } from '@shared/ipc/canvas'
import type { Nature, RootState } from '@shared/ipc/neurons'
import { nextStepOf } from '../../domain/neurons/nextStep'

/** Taille maximale du contexte transmis par une entrée (spec 015 FR-007, research R2). */
export const INPUT_MAX_CHARS = 200_000
/** Extrait gardé d'un document quand le contexte doit être réduit. */
export const DOCUMENT_EXCERPT_CHARS = 2_000

export interface IdeaFacts {
  readonly id: string
  readonly title: string
  readonly nature: Nature
  readonly category: string | null
  readonly state: RootState
  readonly originalText: string
  readonly sheet: SheetData
  readonly plan: readonly PlanStepData[]
  readonly documents: readonly DocumentData[]
}

export interface StepFacts {
  readonly id: string
  readonly genesisId: string
  readonly title: string
  readonly label: string
  readonly rank: number
  readonly depth: number
  readonly status: StepStatus
  readonly why: string | null
  readonly final: { readonly deliverable: string; readonly state: string } | null
  readonly sheet: SheetData
  readonly path: NonNullable<Extract<WidgetInputData, { kind: 'plan_step' }>['path']>
  readonly subtree: NonNullable<Extract<WidgetInputData, { kind: 'plan_step' }>['subtree']>
}

/**
 * Données d'une idée transmises à un widget (spec 015 US3) : uniquement les parties cochées. Fonction pure ;
 * l'identifiant est toujours présent (il distingue les entrées), rien d'autre sans sa partie.
 */
export function assembleIdea(facts: IdeaFacts, parts: readonly IdeaPart[]): WidgetInputData {
  const has = (part: IdeaPart): boolean => parts.includes(part)
  return bound({
    kind: 'idea',
    id: facts.id,
    ...(has('identity')
      ? {
          title: facts.title,
          nature: facts.nature,
          category: facts.category,
          state: facts.state,
          originalText: facts.originalText
        }
      : {}),
    ...(has('sheet') ? { sheet: facts.sheet } : {}),
    ...(has('plan') ? { plan: facts.plan } : {}),
    ...(has('annexes') ? { annexes: { documents: facts.documents } } : {})
  })
}

/** Contexte d'une étape de plan transmis à un widget (spec 015 US2) : uniquement les parties cochées. */
export function assemblePlanStep(facts: StepFacts, parts: readonly StepPart[]): WidgetInputData {
  const has = (part: StepPart): boolean => parts.includes(part)
  return bound({
    kind: 'plan_step',
    id: facts.id,
    genesisId: facts.genesisId,
    ...(has('identity')
      ? {
          title: facts.title,
          label: facts.label,
          rank: facts.rank,
          depth: facts.depth,
          status: facts.status,
          why: facts.why,
          final: facts.final
        }
      : {}),
    ...(has('sheet') ? { sheet: facts.sheet } : {}),
    ...(has('path') ? { path: facts.path } : {}),
    ...(has('subtree') ? { subtree: facts.subtree } : {})
  })
}

/** Ancienne prochaine étape d'un document éclos (archive, spec 005) ; `null` si l'idée n'en a plus. */
export function assembleLegacyStep(
  idea: { readonly id: string; readonly title: string },
  document: HatchedResultView | null
): WidgetInputData | null {
  const text = nextStepOf(document)
  return text === null ? null : { kind: 'step', ideaId: idea.id, ideaTitle: idea.title, text }
}

const EMPTY_SHEET: SheetData = { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] }
const size = (input: WidgetInputData): number => JSON.stringify(input).length

const excerpt = (document: DocumentData): DocumentData =>
  document.content.length <= DOCUMENT_EXCERPT_CHARS
    ? document
    : { ...document, content: `${document.content.slice(0, DOCUMENT_EXCERPT_CHARS)}…` }

/** Documents réduits un à un, du plus long au plus court, tant que l'entrée dépasse la borne. */
function shrinkDocuments(
  documents: readonly DocumentData[],
  fits: (next: readonly DocumentData[]) => boolean
): readonly DocumentData[] {
  const order = documents
    .map((document, index) => ({ index, length: document.content.length }))
    .sort((a, b) => b.length - a.length)
  let current = documents
  for (const { index } of order) {
    if (fits(current)) break
    current = current.map((document, at) => (at === index ? excerpt(document) : document))
  }
  return current
}

/**
 * Borne une entrée (research R2) : d'abord les contenus de documents (extraits), puis, pour une étape, les fiches du
 * chemin du plus éloigné (genesis) au plus proche. Ce qui est proche de la source porte le plus de sens.
 */
export function bound(input: WidgetInputData, max = INPUT_MAX_CHARS): WidgetInputData {
  if (size(input) <= max) return input
  if (input.kind === 'idea') {
    const documents = input.annexes?.documents ?? []
    const shrunk = shrinkDocuments(documents, (next) => size({ ...input, annexes: { documents: next } }) <= max)
    return { ...input, ...(input.annexes === undefined ? {} : { annexes: { documents: shrunk } }), truncated: true }
  }
  if (input.kind !== 'plan_step') return input
  let next: typeof input = input
  if (next.subtree !== undefined) {
    const subtree = next.subtree
    const documents = shrinkDocuments(
      subtree.documents,
      (docs) => size({ ...next, subtree: { ...subtree, documents: docs } }) <= max
    )
    next = { ...next, subtree: { ...subtree, documents } }
  }
  if (next.path !== undefined) {
    const path = [...next.path]
    for (let index = 0; index < path.length && size({ ...next, path }) > max; index++) {
      const entry = path[index]
      if (entry !== undefined) path[index] = { ...entry, sheet: EMPTY_SHEET }
    }
    next = { ...next, path }
  }
  return { ...next, truncated: true }
}
