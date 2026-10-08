import type { CSSProperties, ReactNode } from 'react'
import { NODE_ICONS } from './icons'
import type { NodeIconKey, NodeStatus, NodeVisual } from './nodeVisual'
import { rhythmStyle } from './rhythm'
import './living.css'

/** État d'une racine en orbe : brute (pâle, anneau pointillé), en développement, éclose (onde). */
export type OrbState = 'raw' | 'developing' | 'hatched'

export const STATUS_LABELS: Readonly<Record<NodeStatus, string>> = {
  done: 'Livré',
  doing: 'En cours',
  todo: 'À faire',
  blocked: 'Bloqué'
}

export interface LivingNodeProps {
  readonly id: string
  readonly title: string
  readonly visual: NodeVisual
  /** Racine : diamètre de l'orbe, son état et un pictogramme au centre (projet, « Toi ») ; rien pour une idée. */
  readonly orb?: { readonly size: number; readonly state: OrbState; readonly inner?: NodeIconKey }
  /** Rang d'une étape (①②③). */
  readonly rank?: string
  /** Le nœud a des fichiers à lire dans sa carte (trombone). */
  readonly hasFiles?: boolean
  /** Repli de ses sous-nœuds (D14) : pastille ▸ N / ▾. */
  readonly fold?: { readonly collapsed: boolean; readonly count: number; readonly onToggle: () => void }
  /** Sa carte de détails est ouverte : le nœud grossit et s'éclaire. */
  readonly open?: boolean
  /** Contenu ajouté dans la couche flottante, posé sur le cercle (poignées React Flow, pastilles…). */
  readonly children?: ReactNode
}

/**
 * Nœud vivant (spec 022 D3, D11, D17) : une couche qui flotte à son propre rythme (sans toucher à la position gérée par
 * React Flow), un orbe pour une racine ou un petit cercle coloré par sa grande branche, avec son pictogramme, son rang,
 * sa pastille de statut, son trombone et sa pastille de repli ; le titre dessous.
 */
export function LivingNode({
  id,
  title,
  visual,
  orb,
  rank,
  hasFiles = false,
  fold,
  open = false,
  children
}: LivingNodeProps): React.JSX.Element {
  const Icon = NODE_ICONS[orb?.inner ?? visual.icon]
  const faceStyle = {
    '--living-size': `${orb?.size ?? visual.size}px`,
    ...(visual.branch === null ? {} : { '--living-hue': `var(--color-branch-${visual.branch})` })
  } as CSSProperties
  return (
    <div className="living" data-open={open ? 'true' : undefined} style={rhythmStyle(id) as CSSProperties}>
      <div className="living-float">
        <div
          className={
            orb === undefined ? `living-face living-sat living-d${Math.min(visual.depth, 4)}` : 'living-face living-orb'
          }
          data-state={orb?.state}
          style={faceStyle}
        >
          {orb === undefined ? (
            <Icon className="living-icon" aria-hidden="true" strokeWidth={1.6} />
          ) : (
            <>
              <span className="living-halo" aria-hidden="true" />
              {orb.state === 'hatched' ? <span className="living-ping" aria-hidden="true" /> : null}
              <span className="living-core" aria-hidden="true">
                {orb.inner === undefined ? null : <Icon className="living-icon" strokeWidth={1.6} />}
              </span>
            </>
          )}
          {visual.status === undefined ? null : (
            <span className={`living-status living-status-${visual.status}`} title={STATUS_LABELS[visual.status]}>
              <span className="sr-only">{STATUS_LABELS[visual.status]}</span>
            </span>
          )}
          {rank === undefined ? null : (
            <span className="living-rank" aria-hidden="true">
              {rank}
            </span>
          )}
          {hasFiles ? (
            <span className="living-clip" title="Fichiers à lire dans la carte">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span className="sr-only">Fichiers à lire</span>
            </span>
          ) : null}
          {fold === undefined || fold.count === 0 ? null : (
            <button
              type="button"
              className="living-fold nodrag"
              data-collapsed={fold.collapsed ? 'true' : 'false'}
              aria-expanded={!fold.collapsed}
              aria-label={`${fold.collapsed ? 'Déplier' : 'Replier'} « ${title} » (${fold.count} sous-nœud${fold.count > 1 ? 's' : ''})`}
              onClick={(event) => {
                event.stopPropagation()
                fold.onToggle()
              }}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              {fold.collapsed ? `▸ ${fold.count}` : '▾'}
            </button>
          )}
        </div>
        <span className="living-label">{title}</span>
        {children}
      </div>
    </div>
  )
}
