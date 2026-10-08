import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useQueryClient } from '@tanstack/react-query'
import { ARCHITECTURES, type ArchitectureKind } from '@shared/structure/architecture'
import { useUiStore } from '../../app/uiStore'
import type { ElementStatus, ElementType, ElementView } from '@shared/ipc/canvas'
import { call } from '../../lib/ipc'
import type { ElementNodeType } from '../buildGraph'
import { contentLabel } from '../elementContent'
import { LivingNode } from '../living/LivingNode'
import type { NodeIconKey, NodeStatus } from '../living/nodeVisual'

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

/** Pictogramme de chaque type d'élément (spec 022 D11) ; le libellé du type reste dans la carte et le nom accessible. */
export const ELEMENT_ICONS: Readonly<Record<ElementType, NodeIconKey>> = {
  module: 'module',
  fonctionnalite: 'feature',
  composant: 'component',
  donnee: 'data',
  interface: 'interface',
  tache: 'task',
  decision: 'decision',
  operation: 'operation'
}

/** Statut d'un élément → pastille d'un nœud vivant (livré, en cours, à faire, bloqué). */
export const ELEMENT_NODE_STATUS: Readonly<Record<ElementStatus, NodeStatus>> = {
  idee: 'todo',
  specifiee: 'todo',
  a_faire: 'todo',
  en_cours: 'doing',
  livree: 'done',
  faite: 'done',
  bloquee: 'blocked'
}

/** Couche d'un élément (spec 017 D20), corrigée dans sa carte de détails ; annulable par la notification. */
export function ElementLayerSelect({
  element,
  architecture
}: {
  readonly element: ElementView
  readonly architecture: ArchitectureKind | null | undefined
}): React.JSX.Element | null {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const layers = architecture === null || architecture === undefined ? [] : ARCHITECTURES[architecture].layers
  if (layers.length === 0) return null
  const setLayer = (value: string): void => {
    void call<{ readonly batchId: string }>('element:setLayer', {
      elementId: element.id,
      layer: value === '' ? null : value
    })
      .then(({ batchId }) => {
        showToast(`Couche de « ${element.title} » changée.`, { batchId, undoneText: 'Couche remise comme avant.' })
        return client.invalidateQueries({ queryKey: ['canvas'] })
      })
      .catch(() => showToast('La couche n’a pas pu être changée.'))
  }
  return (
    <span className="flex items-center gap-1 text-xs">
      <select
        value={element.layer ?? ''}
        onChange={(event) => setLayer(event.target.value)}
        aria-label={`Couche de « ${element.title} »`}
        title={
          element.layerSource === 'deduite'
            ? 'Couche déduite par l’app d’après les dossiers : choisis-la pour la fixer'
            : element.layerSource === 'user'
              ? 'Couche choisie par toi'
              : 'Couche donnée par Claude'
        }
        className="nodrag h-7 max-w-44 rounded-md border border-content-muted/40 bg-surface px-1"
      >
        <option value="">Non classé</option>
        {layers.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>
      {element.layerSource === 'deduite' ? <span className="text-content-muted italic">déduite</span> : null}
    </span>
  )
}

/**
 * Élément d'une carte de structure (spec 009, 017) en **petit cercle vivant** (spec 022 US3) : couleur de son module,
 * pictogramme de son type, numéro de progression, pastille de statut (contour en pointillés s'il est bloqué),
 * trombone s'il couvre des fichiers, badge Code / Doc, repli « ▸ N » de ses enfants. Un clic ouvre sa carte de
 * détails (type, statut, résumé, avancement, couche, fichiers) ; le bouton de repli ne l'ouvre pas.
 */
export function ElementNode({ data }: NodeProps<ElementNodeType>): React.JSX.Element {
  const { element, number, visual, open } = data
  const client = useQueryClient()
  const content = element.content ?? null
  const toggle = (): void => {
    void call('element:setCollapsed', { elementId: element.id, collapsed: !element.collapsed }).then(() =>
      client.invalidateQueries({ queryKey: ['canvas'] })
    )
  }
  return (
    <div
      className={`nopan living-element${element.status === 'bloquee' ? ' living-blocked' : ''}`}
      data-content={content?.kind ?? 'none'}
      data-status={element.status ?? 'none'}
    >
      <LivingNode
        id={element.id}
        title={element.title}
        visual={visual}
        {...(number === '' ? {} : { rank: number })}
        hasFiles={element.paths.length > 0 || content !== null}
        {...(content === null ? {} : { fileKind: content.kind, fileTitle: `Cet élément ${contentLabel(content)}` })}
        open={open}
        {...(element.childCount === 0
          ? {}
          : { fold: { collapsed: element.collapsed, count: element.childCount, onToggle: toggle } })}
      >
        <Handle type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
        <Handle type="source" position={Position.Right} isConnectable={false} className="neuron-handle" />
      </LivingNode>
    </div>
  )
}
