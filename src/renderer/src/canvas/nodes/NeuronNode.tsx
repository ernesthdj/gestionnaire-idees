import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { canvasState, SATELLITE_MARGIN, TIER_SIZE, tierOf, type NeuronNodeType } from '../buildGraph'

/** Satellites (premiers sous-neurones) répartis sur un arc à droite du neurone en développement. */
const SATELLITE_ANGLES = [-50, 0, 50]

/** Hexagone pointe en haut, inscrit dans le carré du neurone (repère 0–100). */
const HEXAGON = '50,2 92,26 92,74 50,98 8,74 8,26'

/** Action = triangle « avancer », Réflexion = losange ; dessinés (un caractère ▶ s'afficherait en émoji). */
function NatureIcon({ nature }: { readonly nature: 'action' | 'reflection' }): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      {nature === 'action' ? <path d="M3 1.5v11L12 7z" /> : <path d="M7 1 13 7 7 13 1 7z" />}
    </svg>
  )
}

/** Décalage de dérive propre à chaque idée : elles ne bougent pas toutes en même temps. */
function driftDelay(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `-${hash % 7000}ms`
}

/**
 * Idée de départ (« graine ») de l'écran Idées : hexagone à la couleur réservée `--color-seed`, taille selon le niveau de contexte (FR-029, 5 paliers), aspect selon l'état (FR-009) :
 * brute (pointillés), en développement (plein + satellites), éclose (double contour + halo). Le texte lu par les lecteurs d'écran est porté par le nœud React Flow (`ariaLabel`).
 */
export function NeuronNode({ data }: NodeProps<NeuronNodeType>): React.JSX.Element {
  const { neuron, dimmed } = data
  const state = canvasState(neuron)
  const size = TIER_SIZE[tierOf(neuron)]
  const satelliteDistance = size / 2 + SATELLITE_MARGIN - 8
  const aiProposed = neuron.natureSource === 'ai' || neuron.categorySource === 'ai'
  const style = {
    width: size,
    height: size,
    '--cat': neuron.category?.color ?? '#71717a',
    '--drift-delay': driftDelay(neuron.id)
  } as CSSProperties

  return (
    <div className={`neuron neuron-${state}${dimmed ? ' neuron-dimmed' : ''}`} style={style} aria-hidden="true">
      {/* Graine : hexagone (forme réservée aux idées de départ), liseré à la couleur de la catégorie. */}
      <svg className="neuron-body" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        <polygon className="seed-focus" points={HEXAGON} />
        <polygon className="seed-ring" points={HEXAGON} />
        <polygon className="seed-shape" points={HEXAGON} />
      </svg>
      {state === 'developing'
        ? neuron.subNeurons.map((sub, index) => {
            const angle = ((SATELLITE_ANGLES[index] ?? 0) * Math.PI) / 180
            return (
              <span
                key={sub.id}
                className="neuron-satellite"
                title={sub.title}
                style={{
                  left: size / 2 + satelliteDistance * Math.cos(angle),
                  top: size / 2 + satelliteDistance * Math.sin(angle)
                }}
              />
            )
          })
        : null}
      <span className="absolute inset-0 flex items-center justify-center text-content">
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
      {aiProposed ? (
        <span
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised text-xs text-content"
          title="Nature ou catégorie proposée par l'IA — clic droit pour changer"
        >
          ✦
        </span>
      ) : null}
      <p className="neuron-title">{neuron.title}</p>
      {/* Fiche tenue par Claude dans la conversation du neurone (spec 008) : son résumé sous le titre. */}
      {neuron.sheetSummary === undefined ? null : <p className="neuron-sheet">{neuron.sheetSummary}</p>}
    </div>
  )
}
