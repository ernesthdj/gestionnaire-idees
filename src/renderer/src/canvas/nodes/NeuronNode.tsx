import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { canvasState, TIER_SIZE, tierOf, type NeuronNodeType } from '../buildGraph'
import { LivingNode } from '../living/LivingNode'
import { RepoBadge } from '../../git/RepoBadge'
import { useMapping } from '../mapping/mappingStore'
import { usePlanFold } from '../usePlanFold'

/** Action = triangle « avancer », Réflexion = losange ; dessinés (un caractère ▶ s'afficherait en émoji). */
export function NatureIcon({ nature }: { readonly nature: 'action' | 'reflection' }): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      {nature === 'action' ? <path d="M3 1.5v11L12 7z" /> : <path d="M7 1 13 7 7 13 1 7z" />}
    </svg>
  )
}

/**
 * Idée de départ (genesis) de l'écran Idées en **orbe** (spec 022 D11) : taille selon le niveau de contexte (FR-029,
 * 5 paliers), aspect selon l'état (brute : pâle et pointillée ; éclose : onde), anneau fin à la couleur de sa catégorie,
 * nature au centre ; elle flotte (D3) et grossit quand sa carte de détails est ouverte. Repli de tout son plan (D14).
 * Le texte lu par les lecteurs d'écran est porté par le nœud React Flow (`ariaLabel`).
 */
export function NeuronNode({ data }: NodeProps<NeuronNodeType>): React.JSX.Element {
  const { neuron, dimmed, visual, open, fold } = data
  const toggleFold = usePlanFold()
  const mapping = useMapping((state) => state.phases[neuron.id])
  const aiProposed = neuron.natureSource === 'ai' || neuron.categorySource === 'ai'
  const style = { '--cat': neuron.category?.color ?? 'var(--color-content-muted)' } as CSSProperties
  return (
    <div className={`living-genesis${dimmed ? ' neuron-dimmed' : ''}`} style={style}>
      <LivingNode
        id={neuron.id}
        title={neuron.title}
        visual={visual}
        orb={{ size: TIER_SIZE[tierOf(neuron)], state: canvasState(neuron) }}
        open={open}
        {...(fold === null ? {} : { fold: { ...fold, onToggle: () => void toggleFold(neuron.id, !fold.collapsed) } })}
      >
        {mapping === undefined ? null : (
          <>
            <span className={`living-mapping living-mapping-${mapping}`} aria-hidden="true" />
            <span className={`living-mapping-chip living-mapping-chip-${mapping}`} role="status">
              {mapping === 'running'
                ? 'Cartographie en cours…'
                : mapping === 'done'
                  ? '✓ Cartographie terminée'
                  : 'Cartographie interrompue'}
            </span>
          </>
        )}
        <span className="living-nature" aria-hidden="true">
          <NatureIcon nature={neuron.nature} />
        </span>
        {/* Poignées invisibles au centre : React Flow n'affiche un lien que si ses deux extrémités en ont une.
            Celle de destination reçoit aussi un lien tiré depuis une autre idée (FR-031). */}
        <Handle
          type="target"
          position={Position.Top}
          isConnectableStart={false}
          isConnectableEnd
          className="neuron-handle"
        />
        <Handle type="source" position={Position.Top} isConnectable={false} className="neuron-handle" />
        {/* Point d'accroche visible au survol : on le tire vers une autre idée pour les relier. */}
        <Handle
          id="connect"
          type="source"
          position={Position.Right}
          isConnectableEnd={false}
          className="neuron-connector"
          title="Tirer vers une autre idée pour les relier, ou vers un widget pour la lui transmettre"
        />
        {/* Dépôt du projet lié (spec 021) : branche et fichiers modifiés, clic → volet Dépôt. */}
        {neuron.linkedProject === true ? <RepoBadge genesisId={neuron.id} /> : null}
        {aiProposed ? (
          <span
            className="living-ai absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised text-xs text-content"
            title="Nature ou catégorie proposée par l'IA — clic droit pour changer"
            aria-hidden="true"
          >
            ✦
          </span>
        ) : null}
      </LivingNode>
    </div>
  )
}
