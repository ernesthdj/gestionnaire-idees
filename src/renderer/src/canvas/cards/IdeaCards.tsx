import { useQuery, useQueryClient } from '@tanstack/react-query'
import { memo } from 'react'
import { useInternalNode, useReactFlow, useStore, ViewportPortal } from '@xyflow/react'
import type { ChatView } from '@shared/ipc/chat'
import type { IdeasCanvasView } from '@shared/ipc/canvas'
import { ChatPanel, Sheet } from '../../chat/ChatPanel'
import { call } from '../../lib/ipc'
import type { CanvasNode } from '../buildGraph'
import { FileViewer } from '../FileViewer'
import { FinalPanel } from '../FinalPanel'
import { GhostPanel } from '../GhostPanel'
import { ElementFileReader, ElementFiles } from '../../chat/ElementFiles'
import { contentLabel } from '../elementContent'
import { ELEMENT_STYLES, ElementLayerSelect, STATUS_LABELS } from '../nodes/ElementNode'
import { DeliverableFiles } from '../nodes/DeliverableNode'
import { DocumentReader } from '../nodes/DocumentNode'
import { GhostDecision, StepFinalActions } from '../nodes/PlanNode'
import { usePlanFold } from '../usePlanFold'
import { canChat, cardHead, type CardSubject } from './cardContent'
import { useCards, type OpenCard } from './cardsStore'
import { DetailCard, type NodeBox } from './DetailCard'
import { WorkflowCard, WorkflowFileReader, WorkflowFoundation } from '../workflow/WorkflowCard'
import { useUiStore } from '../../app/uiStore'

/** Fiche tenue par Claude dans la conversation du neurone (spec 008), lue sans démarrer de conversation. */
function NeuronSheet({ neuronId }: { readonly neuronId: string }): React.JSX.Element {
  const view = useQuery({
    queryKey: ['chat-sheet', neuronId],
    queryFn: () => call<ChatView>('chat:open', { neuronId })
  })
  if (view.data?.sheet === null || view.data?.sheet === undefined)
    return <p className="text-content-muted">{view.isError ? 'La fiche n’a pas pu être lue.' : 'Lecture…'}</p>
  return <Sheet sheet={view.data.sheet} />
}

/** Sujet d'une carte d'après son nœud React Flow ; `null` pour un nœud sans carte (bloc, barre). */
export function subjectOf(node: CanvasNode, view: IdeasCanvasView): CardSubject | null {
  switch (node.type) {
    case 'neuron':
      return { kind: 'idea', neuron: node.data.neuron }
    case 'plan': {
      const { item } = node.data
      if (item.kind === 'ghost')
        return { kind: 'ghost', ghost: item.ghost, label: item.label, proposalId: item.proposalId }
      const genesisTitle = view.ideas.find((idea) => idea.id === item.step.genesisId)?.title ?? ''
      return { kind: 'step', step: item.step, label: item.label, genesisTitle }
    }
    case 'document':
      return { kind: 'document', document: node.data.document }
    case 'deliverable':
      return { kind: 'deliverable', deliverable: node.data.deliverable, stepTitle: node.data.title }
    case 'element': {
      const { element, number, progress } = node.data
      return {
        kind: 'element',
        element,
        number,
        typeLabel: ELEMENT_STYLES[element.type].label,
        statusLabel: element.status === null ? null : STATUS_LABELS[element.status],
        percent: progress === undefined || progress === null ? null : progress.percent,
        contentText: contentLabel(element.content),
        note: progress?.fromChildren === true ? null : (element.progressNote ?? null)
      }
    }
    case 'workflow': {
      const { item, genesisId } = node.data
      return item.subject.kind === 'message' ? null : { kind: 'workflow', item, genesisId }
    }
    default:
      return null
  }
}

/** Nœuds liés d'une carte (D6) : parent et sous-étapes d'un plan, idées reliées par un lien libre. */
function relatedOf(subject: CardSubject, view: IdeasCanvasView): { id: string; title: string }[] {
  const titleOf = (id: string): string | undefined =>
    view.ideas.find((idea) => idea.id === id)?.title ?? view.steps.find((step) => step.id === id)?.title
  const stepsUnder = (id: string): { id: string; title: string }[] =>
    view.steps
      .filter((step) => step.parentId === id)
      .sort((a, b) => a.rank - b.rank)
      .map((step) => ({ id: step.id, title: step.title }))
  if (subject.kind === 'idea') {
    const linked = view.mapLinks.flatMap((link) => {
      if (link.from.kind !== 'idea' || link.to.kind !== 'idea') return []
      const other =
        link.from.id === subject.neuron.id ? link.to.id : link.to.id === subject.neuron.id ? link.from.id : null
      const title = other === null ? undefined : titleOf(other)
      return other === null || title === undefined ? [] : [{ id: other, title }]
    })
    return [...stepsUnder(subject.neuron.id), ...linked]
  }
  if (subject.kind === 'step') {
    const parent = titleOf(subject.step.parentId)
    return [
      ...(parent === undefined ? [] : [{ id: subject.step.parentId, title: parent }]),
      ...stepsUnder(subject.step.id)
    ]
  }
  return []
}

/** Neurone d'une carte qui a une conversation. */
function neuronOf(subject: CardSubject): string | null {
  if (subject.kind === 'idea') return subject.neuron.id
  if (subject.kind === 'step') return subject.step.id
  if (subject.kind === 'element') return subject.element.id
  return null
}

function IdeaCard({
  card,
  active,
  view,
  zoom,
  onMenu
}: {
  readonly card: OpenCard
  readonly active: boolean
  readonly view: IdeasCanvasView
  readonly zoom: number
  readonly onMenu: (neuronId: string, at: { x: number; y: number }) => void
}): React.JSX.Element | null {
  const node = useInternalNode<CanvasNode>(card.id)
  const cards = useCards()
  const flow = useReactFlow()
  const toggleFold = usePlanFold()
  const client = useQueryClient()
  const structureViews = useUiStore((state) => state.structureViews)
  if (node === undefined) return null
  const subject = subjectOf(node as CanvasNode, view)
  if (subject === null) return null
  const anchor: NodeBox = {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? node.width ?? 0,
    height: node.measured.height ?? node.height ?? 0
  }
  const neuronId = neuronOf(subject)
  // Le nœud interne porte les mêmes données que le nœud de la carte (plus sa mesure).
  const mapNode = node as CanvasNode
  const fold =
    mapNode.type === 'neuron' || mapNode.type === 'plan'
      ? mapNode.data.fold
      : mapNode.type === 'element' && mapNode.data.element.childCount > 0
        ? { collapsed: mapNode.data.element.collapsed, count: mapNode.data.element.childCount }
        : null
  // Repli depuis la carte : même geste que la pastille du nœud (élément : repli de la carte de structure).
  const onFold = (collapsed: boolean): void => {
    if (mapNode.type !== 'element') {
      void toggleFold(card.id, collapsed)
      return
    }
    void call('element:setCollapsed', { elementId: card.id, collapsed }).then(() =>
      client.invalidateQueries({ queryKey: ['canvas'] })
    )
  }

  // Nœud lié : la vue glisse jusqu'à lui (même zoom), puis sa carte s'ouvre ; les autres restent ouvertes.
  const goto = (id: string): void => {
    const target = flow.getInternalNode(id)
    if (target !== undefined) {
      const { x, y } = target.internals.positionAbsolute
      void flow.setCenter(x + (target.measured.width ?? 0) / 2, y + (target.measured.height ?? 0) / 2, {
        zoom: flow.getZoom(),
        duration: 500
      })
    }
    cards.open(id)
  }

  if (subject.kind === 'workflow') {
    return (
      <WorkflowCard
        card={card}
        active={active}
        anchor={anchor}
        zoom={zoom}
        item={subject.item}
        genesisId={subject.genesisId}
        elements={view.elements.filter((element) => element.genesisId === subject.genesisId)}
        onGoto={goto}
      />
    )
  }

  const sheet =
    subject.kind === 'ghost' ? (
      <GhostPanel view={view} ghostId={subject.ghost.id} onClose={() => cards.toggleSheet(card.id)} />
    ) : subject.kind === 'step' && subject.step.final !== undefined ? (
      <>
        <NeuronSheet neuronId={subject.step.id} />
        <FinalPanel view={view} neuronId={subject.step.id} onClose={() => cards.toggleSheet(card.id)} />
      </>
    ) : neuronId === null ? undefined : (
      <NeuronSheet neuronId={neuronId} />
    )

  const actions =
    subject.kind === 'idea' ? (
      <button
        type="button"
        className="card-button card-button-ghost"
        aria-label={`Menu de « ${subject.neuron.title} »`}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          onMenu(subject.neuron.id, { x: box.right, y: box.top })
        }}
      >
        ⋯ Modifier
      </button>
    ) : subject.kind === 'step' ? (
      <StepFinalActions step={subject.step} />
    ) : subject.kind === 'ghost' ? (
      <GhostDecision title={subject.ghost.title} proposalId={subject.proposalId} ghostId={subject.ghost.id} />
    ) : subject.kind === 'element' ? (
      <ElementLayerSelect
        element={subject.element}
        architecture={mapNode.type === 'element' ? (mapNode.data.architecture ?? null) : null}
      />
    ) : subject.kind === 'document' ? (
      <button
        type="button"
        className="card-button card-button-primary"
        aria-pressed={card.side === 'reader'}
        onClick={() =>
          cards.setSide(card.id, card.side === 'reader' ? null : 'reader', {
            source: 'document',
            path: subject.document.id,
            tab: 'file'
          })
        }
      >
        Lire le document
      </button>
    ) : undefined

  // Vue Workflow d'un projet lié (spec 023 US3) : la fondation dans la carte du genesis, lisible à droite.
  const workflowGenesis =
    subject.kind === 'idea' && subject.neuron.linkedProject === true && structureViews[subject.neuron.id] === 'workflow'
  const side =
    card.side === 'reader' && workflowGenesis && card.reader?.source === 'workflow' ? (
      <WorkflowFileReader
        key={card.reader.path}
        genesisId={card.id}
        path={card.reader.path}
        onClose={() => cards.setSide(card.id, null)}
      />
    ) : card.side === 'chat' && neuronId !== null ? (
      <ChatPanel neuronId={neuronId} onClose={() => cards.setSide(card.id, null)} />
    ) : card.side === 'reader' && subject.kind === 'deliverable' && card.reader !== null ? (
      <FileViewer
        key={card.reader.path}
        neuronId={subject.deliverable.neuronId}
        path={card.reader.path}
        onClose={() => cards.setSide(card.id, null)}
      />
    ) : card.side === 'reader' && subject.kind === 'element' && card.reader !== null ? (
      <ElementFileReader
        key={card.reader.path}
        elementId={subject.element.id}
        path={card.reader.path}
        onBack={() => cards.setSide(card.id, null)}
      />
    ) : card.side === 'reader' && subject.kind === 'document' ? (
      <>
        <div className="flex justify-end">
          <button
            type="button"
            className="detail-card-close"
            aria-label="Fermer le document"
            onClick={() => cards.setSide(card.id, null)}
          >
            ✕
          </button>
        </div>
        <DocumentReader document={subject.document} />
      </>
    ) : undefined

  return (
    <DetailCard
      card={card}
      active={active}
      anchor={anchor}
      zoom={zoom}
      head={cardHead(subject)}
      related={relatedOf(subject, view)}
      {...(workflowGenesis
        ? {
            files: (
              <WorkflowFoundation
                genesisId={card.id}
                onRead={(path) => cards.setSide(card.id, 'reader', { source: 'workflow', path, tab: 'file' })}
              />
            )
          }
        : subject.kind === 'deliverable'
          ? { files: <DeliverableFiles deliverable={subject.deliverable} /> }
          : subject.kind === 'element' && subject.element.paths.length > 0
            ? {
                files: (
                  <ElementFiles
                    elementId={subject.element.id}
                    onOpen={(path) => cards.setSide(card.id, 'reader', { source: 'element', path, tab: 'file' })}
                  />
                )
              }
            : {})}
      {...(actions === undefined ? {} : { actions })}
      {...(sheet === undefined ? {} : { sheet })}
      {...(subject.kind === 'ghost' ? { sheetLabel: 'Pourquoi' } : {})}
      canChat={canChat(subject)}
      {...(side === undefined ? {} : { side })}
      {...(fold === null
        ? {}
        : {
            fold: {
              ...fold,
              onToggle: () => onFold(!fold.collapsed),
              noun: mapNode.type === 'element' ? 'sous-éléments' : 'sous-étapes'
            }
          })}
      onActivate={() => cards.activate(card.id)}
      onClose={() => cards.close(card.id)}
      onMove={(offset) => cards.move(card.id, offset)}
      onToggleSheet={() => cards.toggleSheet(card.id)}
      onTogglePin={() => cards.togglePin(card.id)}
      onToggleChat={() => cards.setSide(card.id, card.side === 'chat' ? null : 'chat')}
      onEscape={() => (card.side === 'reader' ? cards.setSide(card.id, null) : cards.close(card.id))}
      onGoto={goto}
    />
  )
}

/**
 * Cartes de détails ouvertes sur la carte des idées (spec 022) : dans la couche de la carte (elles suivent leur nœud
 * et le zoom). Une carte dont le nœud a disparu (supprimé, filtré, replié) n'est pas dessinée.
 */
export const IdeaCards = memo(function IdeaCards({
  view,
  onMenu
}: {
  readonly view: IdeasCanvasView
  readonly onMenu: (neuronId: string, at: { x: number; y: number }) => void
}): React.JSX.Element {
  const cards = useCards((state) => state.cards)
  const activeId = useCards((state) => state.activeId)
  const zoom = useStore((state) => state.transform[2])
  return (
    <ViewportPortal>
      {cards.map((card) => (
        <IdeaCard key={card.id} card={card} active={card.id === activeId} view={view} zoom={zoom} onMenu={onMenu} />
      ))}
    </ViewportPortal>
  )
})
