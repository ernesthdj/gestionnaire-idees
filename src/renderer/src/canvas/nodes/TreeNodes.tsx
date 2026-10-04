import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { CSSProperties } from 'react'
import type { NeuronKind, WebSourceView } from '@shared/ipc/neurons'
import type { PlacedItem } from '../ideaTreeLayout'

/** Taille des éléments de l'arbre (multiples de 8) et encombrement pour la physique (titre compris). */
export const TREE_SIZE = { neuron: 48, idea: 56, slot: 32 } as const
export const TREE_RADIUS = { neuron: 76, idea: 80, slot: 24, note: 108 } as const

const KIND_LABELS: Record<NeuronKind, string> = {
  root: 'idée',
  answer: 'réponse',
  condition: 'condition',
  branch: 'branche',
  opportunity: 'opportunité',
  investigation: 'à trouver',
  user_branch: 'ma branche',
  idea: 'idée suggérée',
  element: 'élément de projet'
}

export type TreeNodeData = {
  readonly placed: PlacedItem
  readonly focused: boolean
  readonly selected: boolean
  readonly categoryColor: string
  readonly onDismiss: (suggestionId: string) => void
  readonly onResearch: (suggestionId: string) => void
}
export type TreeNodeType = Node<TreeNodeData, 'tree'>

export type NoteNodeData = { readonly itemId: string; readonly text: string; readonly open: boolean }
export type NoteNodeType = Node<NoteNodeData, 'note'>

export type DocNodeData = {
  readonly title: string
  readonly content: string | null
  readonly sources: readonly WebSourceView[]
  readonly onClose: () => void
}
export type DocNodeType = Node<DocNodeData, 'doc'>

/** Une idée (suggérée ou acceptée) : losange, texte sur son lien, fiche au double-clic. */
export function isIdeaItem(placed: PlacedItem): boolean {
  return placed.item.type === 'ghost' || (placed.item.type === 'neuron' && placed.item.kind === 'idea')
}

export function treeSize(placed: PlacedItem): number {
  if (placed.item.type === 'slot') return TREE_SIZE.slot
  return isIdeaItem(placed) ? TREE_SIZE.idea : TREE_SIZE.neuron
}

export function treeRadius(placed: PlacedItem): number {
  if (placed.item.type === 'slot') return TREE_RADIUS.slot
  return isIdeaItem(placed) ? TREE_RADIUS.idea : TREE_RADIUS.neuron
}

/** Texte lu par les lecteurs d'écran pour un élément de l'arbre (porté par le nœud React Flow). */
export function treeAriaLabel(placed: PlacedItem): string {
  const { item } = placed
  switch (item.type) {
    case 'neuron': {
      const more = item.descendants > 0 ? `, ${item.descendants} sous-neurones` : ''
      if (item.kind === 'idea') return `Idée suggérée : ${item.title}${more}. Double-clic pour lire sa fiche`
      return `${KIND_LABELS[item.kind]} : ${item.title}${item.origin === 'ai' ? ' (proposé par l’IA)' : ''}${more}`
    }
    case 'pending':
      return `Nouveau sous-neurone : ${item.title}`
    case 'ghost': {
      const research =
        item.suggestion.research === 'pending'
          ? ', vérification web en cours'
          : item.suggestion.research === 'done'
            ? ', vérifiée sur le web'
            : item.suggestion.research === 'available'
              ? ', vérifiable sur le web'
              : ''
      return `Idée suggérée par l’IA : ${item.suggestion.title}${research}. Entrée pour l’accepter, Échap pour l’ignorer`
    }
    case 'slot':
      return `Question : ${item.extension.question}`
  }
}

/** Hostname affiché pour une source web (le lien lui-même s'ouvre dans le navigateur système). */
function domainOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : url
}

function Sources({ sources }: { readonly sources: readonly WebSourceView[] }): React.JSX.Element | null {
  if (sources.length === 0) return null
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {sources.map((source) => (
        <li key={source.url}>
          {/* Ouvert dans le navigateur système (https uniquement, filtré par le processus principal). */}
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="nodrag underline">
            {source.title} <span className="text-content-muted">— {domainOf(source.url)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Poignées invisibles au centre : React Flow n'affiche un trait que si ses deux extrémités en ont une. */
function CenterHandles(): React.JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
      <Handle type="source" position={Position.Top} isConnectable={false} className="neuron-handle" />
    </>
  )
}

/**
 * Élément de l'arbre d'une idée ouverte, sur la carte (FR-013, FR-032) : sous-neurone, idée suggérée (losange), en
 * attente, ou question « + ». Glissable comme tout objet de la carte ; le clic est géré par la carte.
 */
export function TreeNode({ data }: NodeProps<TreeNodeType>): React.JSX.Element {
  const { placed, focused, selected } = data
  const { item } = placed
  const size = treeSize(placed)
  const style = { width: size, height: size, '--cat': data.categoryColor } as CSSProperties

  switch (item.type) {
    case 'neuron':
      if (item.kind === 'idea') {
        return (
          <div className={`idea-gem${focused ? ' idea-gem-focus' : ''}`} style={style} aria-hidden="true">
            <span className="idea-gem-glyph">✦</span>
            <span className="dive-title">{item.title}</span>
            <CenterHandles />
          </div>
        )
      }
      return (
        <div
          className={`dive-node dive-node-child${item.kind === 'investigation' ? ' dive-node-investigation' : ''}${focused ? ' dive-node-focus' : ''}`}
          style={style}
          aria-hidden="true"
        >
          {item.origin === 'ai' ? <span className="dive-badge">✦</span> : null}
          <span className="dive-title">{item.title}</span>
          <CenterHandles />
        </div>
      )
    case 'pending':
      return (
        <div className="dive-node dive-node-child dive-node-pending" style={style} aria-hidden="true">
          <span className="dive-title">{item.title}</span>
          <CenterHandles />
        </div>
      )
    case 'ghost':
      return (
        <div className="dive-ghost-wrap" style={style}>
          <div className="idea-gem idea-gem-ghost h-full w-full" aria-hidden="true">
            <span className="idea-orbit" />
            <span className="dive-title">{item.suggestion.title}</span>
            {item.suggestion.research === 'pending' ? <span className="dive-research">⟳</span> : null}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              data.onDismiss(item.suggestion.id)
            }}
            aria-label={`Ignorer la suggestion : ${item.suggestion.title}`}
            className="nodrag dive-ghost-dismiss"
          >
            ×
          </button>
          {item.suggestion.research === 'available' ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                data.onResearch(item.suggestion.id)
              }}
              aria-label={`Vérifier sur le web : ${item.suggestion.title}`}
              title="Vérifier sur le web (utilise des crédits Claude)"
              className="nodrag dive-ghost-research"
            >
              🔍
            </button>
          ) : null}
          {item.suggestion.sources.length > 0 ? (
            <div className="dive-sources">
              <Sources sources={item.suggestion.sources} />
            </div>
          ) : null}
          <CenterHandles />
        </div>
      )
    case 'slot':
      return (
        <div
          className={`dive-slot flex items-center justify-center${selected ? ' dive-slot-selected' : ''}`}
          style={style}
          aria-hidden="true"
          title={item.extension.question}
        >
          +
          <CenterHandles />
        </div>
      )
  }
}

/** Texte d'une idée, accroché à elle sur la carte : quatre lignes, en entier au clic (FR-032). */
export function NoteNode({ data }: NodeProps<NoteNodeType>): React.JSX.Element {
  return (
    <div className={`idea-note${data.open ? ' idea-note-open' : ''}`} aria-hidden="true">
      {data.text}
    </div>
  )
}

/** Fiche d'une idée, posée à côté d'elle (double-clic) : conseils complets et sources. × ou Échap referme. */
export function DocNode({ data }: NodeProps<DocNodeType>): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-label={`Fiche de l’idée : ${data.title}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          data.onClose()
        }
      }}
      className="nodrag nowheel idea-doc"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">
          <span aria-hidden="true" className="idea-doc-glyph">
            ✦{' '}
          </span>
          {data.title}
        </p>
        <button
          type="button"
          autoFocus
          onClick={data.onClose}
          aria-label="Fermer la fiche"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-surface-raised"
        >
          ×
        </button>
      </div>
      <p className="mt-2 whitespace-pre-line text-content">
        {data.content ?? 'Pas encore de conseils pour cette idée.'}
      </p>
      <Sources sources={data.sources} />
    </div>
  )
}
