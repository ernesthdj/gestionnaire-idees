import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useQueryClient } from '@tanstack/react-query'
import type { ElementStatus, ElementType } from '@shared/ipc/canvas'
import { call } from '../../lib/ipc'
import type { ElementNodeType } from '../buildGraph'
import { ELEMENT_SIZE } from '../structureGraph'

/** Pastille de chaque type d'élément (L1e §3) : symbole et couleur, toujours accompagnés du libellé (pas la couleur seule). */
export const ELEMENT_STYLES: Readonly<
  Record<ElementType, { readonly icon: string; readonly label: string; readonly tone: string }>
> = {
  module: { icon: '▣', label: 'Module', tone: 'border-sky-500/60 text-sky-700 dark:text-sky-300' },
  fonctionnalite: {
    icon: '◆',
    label: 'Fonctionnalité',
    tone: 'border-violet-500/60 text-violet-700 dark:text-violet-300'
  },
  composant: { icon: '▢', label: 'Composant', tone: 'border-emerald-500/60 text-emerald-700 dark:text-emerald-300' },
  donnee: { icon: '⛁', label: 'Donnée', tone: 'border-amber-500/60 text-amber-700 dark:text-amber-300' },
  interface: { icon: '⇄', label: 'Interface', tone: 'border-cyan-500/60 text-cyan-700 dark:text-cyan-300' },
  tache: { icon: '☐', label: 'Tâche', tone: 'border-rose-500/60 text-rose-700 dark:text-rose-300' },
  decision: { icon: '◇', label: 'Décision', tone: 'border-zinc-500/60 text-zinc-700 dark:text-zinc-300' },
  operation: { icon: '✚', label: 'Opération', tone: 'border-orange-500/60 text-orange-700 dark:text-orange-300' }
}

export const STATUS_LABELS: Readonly<Record<ElementStatus, string>> = {
  idee: 'idée',
  specifiee: 'spécifiée',
  en_cours: 'en cours',
  livree: 'livrée',
  a_faire: 'à faire',
  faite: 'faite',
  bloquee: 'bloquée'
}

/**
 * Élément d'une carte de structure (spec 009) : type, titre, statut, résumé, fichiers, et « ▸ N » pour déplier ses
 * enfants. Un clic sur la carte ouvre sa conversation (géré par la carte) ; le bouton de repli ne l'ouvre pas.
 */
export function ElementNode({ data }: NodeProps<ElementNodeType>): React.JSX.Element {
  const { element } = data
  const client = useQueryClient()
  const style = ELEMENT_STYLES[element.type]
  const toggle = (event: React.MouseEvent): void => {
    event.stopPropagation()
    void call('element:setCollapsed', { elementId: element.id, collapsed: !element.collapsed }).then(() =>
      client.invalidateQueries({ queryKey: ['canvas'] })
    )
  }
  return (
    <article
      className={`relative flex flex-col gap-1 overflow-hidden rounded-lg border-2 bg-surface-raised px-3 py-2 shadow-sm ${style.tone}`}
      style={{ width: ELEMENT_SIZE.width, height: ELEMENT_SIZE.height }}
    >
      <header className="flex items-center gap-2 text-[11px] font-medium">
        <span aria-hidden="true">{style.icon}</span>
        <span>{style.label}</span>
        {element.status === null ? null : (
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-content-muted">
            {STATUS_LABELS[element.status]}
          </span>
        )}
        {element.paths.length === 0 ? null : (
          <span className="ml-auto text-content-muted" title={element.paths.join('\n')}>
            {element.paths.length} fichier{element.paths.length > 1 ? 's' : ''}
          </span>
        )}
      </header>
      <h3 className="truncate text-sm font-semibold text-content">{element.title}</h3>
      {element.summary === null ? null : (
        <p className="line-clamp-2 text-xs leading-snug text-content-muted">{element.summary}</p>
      )}
      {element.childCount === 0 ? null : (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!element.collapsed}
          aria-label={`${element.collapsed ? 'Déplier' : 'Replier'} « ${element.title} » (${element.childCount} éléments)`}
          className="nodrag absolute right-2 bottom-1 rounded px-1.5 text-xs text-content hover:bg-surface"
        >
          {element.collapsed ? `▸ ${element.childCount}` : '▾'}
        </button>
      )}
      <Handle type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="neuron-handle" />
    </article>
  )
}
