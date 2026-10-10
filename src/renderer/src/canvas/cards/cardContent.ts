import type { CanvasNeuronView, ElementView, ProposalView, StepStatus, StepView } from '@shared/ipc/canvas'
import type { DocumentView } from '@shared/ipc/documents'
import type { DeliverableView } from '@shared/ipc/finals'
import { BRANCH_TITLES, SPEC_STATUS_LABELS, TASK_STATE_LABELS, type WorkflowItem } from '../workflow/workflowTree'

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
      /** Libellé du type, du statut et avancement affiché (déclaré ou moyenne des sous-éléments), s'ils existent. */
      readonly typeLabel: string
      readonly statusLabel: string | null
      readonly percent: number | null
      /** Ce qu'il contient (« contient du code »…) et ce qui reste à faire, s'ils sont connus. */
      readonly contentText: string | null
      readonly note: string | null
    }
  /** Nœud de la vue Workflow (spec 023) : branche, spec, user story, socle, tâche ou idée à brainstormer. */
  | { readonly kind: 'workflow'; readonly item: WorkflowItem; readonly genesisId: string }

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
      const summary = [nonEmpty(element.summary), subject.note === null ? null : `Reste : ${subject.note}`]
        .filter((part): part is string => part !== null)
        .join(' ')
      return {
        badge: subject.typeLabel,
        meta:
          [subject.number === '' ? null : `n° ${subject.number}`, subject.statusLabel, subject.contentText]
            .filter((part): part is string => part !== null && part !== '')
            .join(' · ') || null,
        title: element.title,
        summary: summary === '' ? null : summary,
        gauge:
          subject.percent === null
            ? null
            : { label: 'Avancement', value: subject.percent, text: `${subject.percent} %` }
      }
    }
    case 'workflow':
      return workflowHead(subject.item)
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

const progressGauge = (done: number, total: number): CardGauge | null =>
  total === 0 ? null : { label: 'Avancement', value: Math.round((done / total) * 100), text: `${done}/${total} tâches` }

const plain = (text: string): string => text.replace(/`/g, '').replace(/\s+/g, ' ').trim()

/** En-tête de la carte d'un nœud Workflow (spec 023 US2, US3). */
function workflowHead(item: WorkflowItem): CardHead {
  const { subject } = item
  switch (subject.kind) {
    case 'branch': {
      const count = subject.specs.length
      return {
        badge: 'Branche',
        meta: subject.branch === 'brainstorm' ? null : `${count} spec${count > 1 ? 's' : ''}`,
        title: BRANCH_TITLES[subject.branch],
        summary: count === 0 ? null : subject.specs.map((spec) => `${spec.number} ${spec.title}`).join(' · '),
        gauge: null
      }
    }
    case 'spec': {
      const { spec } = subject
      return {
        badge: `Spec ${spec.number}`,
        meta:
          [
            SPEC_STATUS_LABELS[spec.status],
            spec.createdAt === null ? null : `créée le ${spec.createdAt}`,
            spec.decisions === 0 ? null : `${spec.decisions} décision${spec.decisions > 1 ? 's' : ''}`,
            spec.partial ? 'lecture partielle' : null
          ]
            .filter((part): part is string => part !== null)
            .join(' · ') || null,
        title: spec.title,
        summary: spec.statusLine,
        gauge: progressGauge(spec.done, spec.total)
      }
    }
    case 'story': {
      const { spec, story } = subject
      return {
        badge: `User story ${story.number}${story.priority === null ? '' : ` · P${story.priority}`}`,
        meta: `Spec ${spec.number} · ${spec.title}`,
        title: story.described ? story.title : '(user story non décrite)',
        summary: story.delivered ? 'Livrée.' : null,
        gauge: progressGauge(story.done, story.total)
      }
    }
    case 'socle': {
      const { spec } = subject
      const done = spec.socle.filter((task) => task.done).length
      return {
        badge: 'Socle',
        meta: `Spec ${spec.number} · ${spec.title}`,
        title: 'Mise en place, fondations, finitions',
        summary: 'Tâches de la spec qui n’appartiennent à aucune user story.',
        gauge: progressGauge(done, spec.socle.length)
      }
    }
    case 'task': {
      const { spec, story, task } = subject
      const text = plain(task.text)
      return {
        badge: `Tâche ${task.id}`,
        meta: `${story === null ? 'Socle' : `US${story.number}`} · Spec ${spec.number} · ${task.done ? 'faite' : 'à faire'}`,
        title: text.length <= 120 ? text : `${text.slice(0, 119)}…`,
        summary: text.length <= 120 ? null : text,
        gauge: null
      }
    }
    case 'done': {
      const { spec, story, tasks } = subject
      return {
        badge: 'Tâches faites',
        meta: `${story === null ? 'Socle' : `US${story.number}`} · Spec ${spec.number}`,
        title: `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} faite${tasks.length > 1 ? 's' : ''}`,
        summary: 'Chacune s’ouvre avec ses fichiers et leur code.',
        gauge: null
      }
    }
    case 'doc': {
      const count = subject.family.length
      return {
        badge: 'À brainstormer',
        meta: subject.doc.name,
        title: subject.doc.title,
        summary:
          count === 0 ? null : `${count} document${count > 1 ? 's' : ''} de détail (niveaux 2 à 4) dans sa famille.`,
        gauge: null
      }
    }
    case 'taskFile': {
      const { file } = subject
      return {
        badge: 'Fichier de tâches',
        meta: [file.path, SPEC_STATUS_LABELS[file.status], file.partial ? 'lecture partielle' : null]
          .filter((part): part is string => part !== null)
          .join(' · '),
        title: file.title,
        summary: null,
        gauge: progressGauge(file.done, file.total)
      }
    }
    case 'taskGroup': {
      const { file, group } = subject
      return {
        badge: group.groups.length > 0 || file.lots.includes(group) ? 'Lot' : 'Groupe',
        meta: `${file.title} · ${SPEC_STATUS_LABELS[group.status]}`,
        title: group.title,
        summary: null,
        gauge: progressGauge(group.done, group.total)
      }
    }
    case 'fileTask': {
      const { file, group, task } = subject
      const text = plain(task.text)
      return {
        badge: task.id === '' ? 'Tâche' : `Tâche ${task.id}`,
        meta: `${group === null ? file.title : group.title} · ${TASK_STATE_LABELS[task.state]}`,
        title: text.length <= 120 ? text : `${text.slice(0, 119)}…`,
        summary: text.length <= 120 ? null : text,
        gauge: null
      }
    }
    case 'fileDone': {
      const { file, group, tasks } = subject
      return {
        badge: 'Tâches faites',
        meta: group === null ? file.title : `${group.title} · ${file.title}`,
        title: `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} faite${tasks.length > 1 ? 's' : ''}`,
        summary: null,
        gauge: null
      }
    }
    case 'message':
      return { badge: 'Workflow', meta: null, title: subject.text, summary: null, gauge: null }
  }
}

/** Sorte de nœud qui a une conversation (« Discuter ») : idée et étape. */
export const canChat = (subject: CardSubject): boolean =>
  subject.kind === 'idea' || subject.kind === 'step' || subject.kind === 'element'
