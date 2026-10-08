import type { CanvasNeuronView, ElementView, ProposalView, StepStatus, StepView } from '@shared/ipc/canvas'
import type { DocumentView } from '@shared/ipc/documents'
import type { DeliverableView } from '@shared/ipc/finals'

/**
 * Contenu d'une carte de détails (spec 022 D6, D7) selon la sorte de nœud : badge, ligne d'information, titre, résumé et
 * jauge d'énergie (valeur 0–100 et libellé en clair). Une rubrique sans donnée est absente (`null`). Fonctions pures.
 */

export type CardSubject =
  | { readonly kind: 'idea'; readonly neuron: CanvasNeuronView }
  | { readonly kind: 'step'; readonly step: StepView; readonly label: string; readonly genesisTitle: string }
  | {
      readonly kind: 'ghost'
      readonly ghost: ProposalView['items'][number]
      readonly label: string
      readonly proposalId: string
    }
  | { readonly kind: 'document'; readonly document: DocumentView }
  | { readonly kind: 'deliverable'; readonly deliverable: DeliverableView; readonly stepTitle: string }
  | {
      readonly kind: 'element'
      readonly element: ElementView
      readonly number: string
      /** Libellé du statut et avancement affiché (déclaré ou moyenne des sous-éléments), s'ils existent. */
      readonly statusLabel: string | null
      readonly percent: number | null
    }

export interface CardGauge {
  readonly label: string
  readonly value: number
  readonly text: string
}

export interface CardHead {
  readonly badge: string
  readonly meta: string | null
  readonly title: string
  readonly summary: string | null
  readonly gauge: CardGauge | null
}

const STATE_BADGES = { raw: 'Idée brute', developing: 'En développement', hatched: 'Idée éclose' } as const

/** Maturité d'une idée (D7) : palier de contexte → énergie. */
const MATURITY: Readonly<Record<'raw' | 'insufficient' | 'sufficient' | 'complete' | 'hatched', CardGauge>> = {
  raw: { label: 'Maturité', value: 10, text: 'Brute' },
  insufficient: { label: 'Maturité', value: 35, text: 'Contexte insuffisant' },
  sufficient: { label: 'Maturité', value: 65, text: 'Contexte suffisant' },
  complete: { label: 'Maturité', value: 90, text: 'Contexte complet' },
  hatched: { label: 'Maturité', value: 100, text: 'Éclose' }
}

/** Avancement d'une étape (D7) : statut → énergie. */
export const STEP_PROGRESS: Readonly<Record<StepStatus, CardGauge>> = {
  a_faire: { label: 'Avancement', value: 10, text: 'À faire' },
  en_cours: { label: 'Avancement', value: 55, text: 'En cours' },
  fait: { label: 'Avancement', value: 100, text: 'Fait' },
  bloque: { label: 'Avancement', value: 10, text: 'Bloqué' }
}

const nonEmpty = (text: string | undefined | null): string | null =>
  text === undefined || text === null || text.trim() === '' ? null : text

export function cardHead(subject: CardSubject): CardHead {
  switch (subject.kind) {
    case 'idea': {
      const { neuron } = subject
      const tier = neuron.state === 'hatched' ? 'hatched' : (neuron.contextLevel ?? 'raw')
      const state = neuron.state === 'hatched' ? 'hatched' : neuron.state === 'developing' ? 'developing' : 'raw'
      const category = neuron.category === null ? 'à classer' : neuron.category.label
      return {
        badge: STATE_BADGES[state],
        meta: `${neuron.nature === 'action' ? 'Action' : 'Réflexion'} · ${category}`,
        title: neuron.title,
        summary: nonEmpty(neuron.sheetSummary),
        gauge: MATURITY[tier]
      }
    }
    case 'step': {
      const { step } = subject
      return {
        badge: step.final === undefined ? 'Étape' : 'Action finale',
        meta: `${subject.label} · ${subject.genesisTitle}${step.locked ? ' · verrouillée' : ''}`,
        title: step.title,
        summary: nonEmpty(step.sheetSummary) ?? nonEmpty(step.final?.deliverable),
        gauge: STEP_PROGRESS[step.status]
      }
    }
    case 'ghost':
      return {
        badge: 'Étape proposée par Claude',
        meta: subject.label,
        title: subject.ghost.title,
        summary: nonEmpty(subject.ghost.why),
        gauge: null
      }
    case 'document':
      return {
        badge: subject.document.origin === 'claude' ? 'Document · par Claude' : 'Document',
        meta: subject.document.fileLabel,
        title: subject.document.title,
        summary: null,
        gauge: null
      }
    case 'element': {
      const { element } = subject
      return {
        badge: element.type,
        meta:
          [subject.number === '' ? null : `n° ${subject.number}`, subject.statusLabel].filter(Boolean).join(' · ') ||
          null,
        title: element.title,
        summary: nonEmpty(element.summary),
        gauge:
          subject.percent === null
            ? null
            : { label: 'Avancement', value: subject.percent, text: `${subject.percent} %` }
      }
    }
    case 'deliverable': {
      const count = subject.deliverable.files.length
      return {
        badge: 'Livrable',
        meta: `${count} fichier${count > 1 ? 's' : ''}${subject.deliverable.executing ? ' · Claude écrit…' : ''}`,
        title: `Livrable de « ${subject.stepTitle} »`,
        summary: null,
        gauge: null
      }
    }
  }
}

/** Sorte de nœud qui a une conversation (« Discuter ») : idée et étape. */
export const canChat = (subject: CardSubject): boolean =>
  subject.kind === 'idea' || subject.kind === 'step' || subject.kind === 'element'
