import type { HatchedResultView, TreeView } from '@shared/ipc/neurons'
import type { IdeaPart, WidgetInputData } from '@shared/ipc/widgetIo'
import { nextStepOf } from '../../domain/neurons/nextStep'

export interface IdeaFacts {
  readonly tree: TreeView
  readonly answers: readonly { readonly question: string; readonly answer: string }[]
  readonly document: HatchedResultView | null
}

/**
 * Données d'une idée transmises à un widget (spec 005 FR-003) : uniquement les parties cochées. Fonction pure ;
 * l'identifiant de l'idée est toujours présent (il distingue les entrées), rien d'autre sans sa partie.
 */
export function assembleIdea(facts: IdeaFacts, parts: readonly IdeaPart[]): WidgetInputData {
  const { root, neurons } = facts.tree
  const has = (part: IdeaPart): boolean => parts.includes(part)
  return {
    kind: 'idea',
    id: root.id,
    ...(has('identity')
      ? { title: root.title, nature: root.nature, category: root.category?.label ?? null, state: root.state }
      : {}),
    ...(has('original') ? { originalText: root.content ?? root.title } : {}),
    ...(has('answers') ? { answers: facts.answers } : {}),
    ...(has('tree')
      ? {
          tree: neurons.map((neuron) => ({
            id: neuron.id,
            parentId: neuron.parentId,
            kind: neuron.kind,
            title: neuron.title,
            content: neuron.content,
            amountCents: neuron.amountCents,
            dueDate: neuron.dueDate
          }))
        }
      : {}),
    ...(has('document') ? { document: facts.document, nextStep: nextStepOf(facts.document) } : {})
  }
}

/** Prochaine étape d'une idée transmise à un widget ; `null` si l'idée n'en a plus. */
export function assembleStep(facts: IdeaFacts): WidgetInputData | null {
  const text = nextStepOf(facts.document)
  return text === null ? null : { kind: 'step', ideaId: facts.tree.root.id, ideaTitle: facts.tree.root.title, text }
}
