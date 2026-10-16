import type { CSSProperties, ReactNode } from 'react'
import { useWaitingChats } from '../../chat/waitingChats'
import { shownNodeId, useSidePanel } from '../side/sidePanelStore'
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
  /** Contenu connu de ces fichiers : la pastille montre « </> » (code) ou « Doc » au lieu du trombone. */
  readonly fileKind?: 'code' | 'doc'
  /** Infobulle de la pastille de fichiers. */
  readonly fileTitle?: string
  /** Repli de ses sous-nœuds (D14) : pastille ▸ N / ▾. */
  readonly fold?: { readonly collapsed: boolean; readonly count: number; readonly onToggle: () => void }
  /** Sa carte de détails est ouverte : le nœud grossit et s'éclaire. */
  readonly open?: boolean
  /** Ligne discrète sous le titre (avancement « 33/49 », lecture partielle…). */
  readonly meta?: string
  /** Neurone de sa conversation, si ce n'est pas `id` (nœud Workflow) : « attend ton accord » quand Claude attend. */
  readonly chatId?: string
  /**
   * Rond du Workflow (spec 032 D3) : deux anneaux fins autour du cercle, l'extérieur pour la maturité du brainstorm,
   * l'intérieur pour l'avancement des tâches (en %, `null` : non évalué ou rien à faire).
   */
  readonly rings?: { readonly brainstorm: number | null; readonly tasks?: number | null }
  /** Carré du Workflow (spec 032 D4, D5) : une tâche, pleine quand elle est faite ; ébauche si le brainstorm n'est pas fini. */
  readonly square?: { readonly sketch: boolean }
  /** Le carré « ▶ Bosser ici » (spec 032 D6) : un halo et une étiquette. */
  readonly next?: boolean
  /** Le rond du brainstorm à compléter d'abord (« ▶ Compléter ici », spec 032 D18) : même halo, son étiquette. */
  readonly complete?: boolean
  /** Contenu ajouté dans la couche flottante, posé sur le cercle (poignées React Flow, pastilles…). */
  readonly children?: ReactNode
}

/**
 * Nœud vivant (spec 022 D3, D11, D17) : une couche qui flotte à son propre rythme (sans toucher à la position gérée par
 * React Flow), un orbe pour une racine ou un petit cercle coloré par sa grande branche, avec son pictogramme, son rang,
 * sa pastille de statut, son trombone et sa pastille de repli ; le titre dessous. Un anneau signale que sa conversation est
 * l'onglet affiché du panneau de droite (spec 027).
 */
export function LivingNode({
  id,
  title,
  visual,
  orb,
  rank,
  hasFiles = false,
  fileKind,
  fileTitle = 'Fichiers à lire dans la carte',
  fold,
  open = false,
  meta,
  chatId = id,
  rings,
  square,
  next = false,
  complete = false,
  children
}: LivingNodeProps): React.JSX.Element {
  const waiting = useWaitingChats((state) => state.waiting.has(chatId))
  // Conversation affichée dans le panneau de droite (spec 027 D4) : anneau « conversation ouverte », sur un seul nœud.
  const chatShown = useSidePanel((state) => shownNodeId(state) === id)
  const Icon = NODE_ICONS[orb?.inner ?? visual.icon]
  const faceStyle = {
    '--living-size': `${orb?.size ?? visual.size}px`,
    ...(visual.branch === null ? {} : { '--living-hue': `var(--color-branch-${visual.branch})` }),
    ...(rings === undefined
      ? {}
      : { '--ring-brainstorm': `${rings.brainstorm ?? 0}%`, '--ring-tasks': `${rings.tasks ?? 0}%` })
  } as CSSProperties
  return (
    <div
      className="living"
      data-open={open ? 'true' : undefined}
      data-chat={chatShown ? 'true' : undefined}
      style={rhythmStyle(id) as CSSProperties}
    >
      <div className="living-float">
        <div
          className={
            orb === undefined ? `living-face living-sat living-d${Math.min(visual.depth, 4)}` : 'living-face living-orb'
          }
          data-state={orb?.state}
          data-shape={square === undefined ? undefined : 'square'}
          data-sketch={square?.sketch === true ? 'true' : undefined}
          data-done={square !== undefined && visual.status === 'done' ? 'true' : undefined}
          data-next={next || complete ? 'true' : undefined}
          style={faceStyle}
        >
          {rings === undefined ? null : (
            <>
              <span
                className="living-ring living-ring-brainstorm"
                data-unrated={rings.brainstorm === null ? 'true' : undefined}
                aria-hidden="true"
              />
              {rings.tasks === undefined ? null : <span className="living-ring living-ring-tasks" aria-hidden="true" />}
            </>
          )}
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
          {hasFiles && fileKind !== undefined ? (
            <span className="living-clip living-clip-kind" title={fileTitle}>
              <span aria-hidden="true">{fileKind === 'code' ? '</>' : 'Doc'}</span>
              <span className="sr-only">Fichiers à lire</span>
            </span>
          ) : hasFiles ? (
            <span className="living-clip" title={fileTitle}>
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
        <span className="living-label">
          {title}
          {meta === undefined ? null : <span className="living-meta">{meta}</span>}
          {next ? <span className="living-next-tag">▶ Bosser ici</span> : null}
          {complete ? <span className="living-next-tag">▶ Compléter ici</span> : null}
          {waiting ? (
            <span
              role="status"
              className="mt-1 inline-block rounded-full border border-amber-500/60 bg-surface-raised px-2 py-0.5 text-[10.5px] font-semibold text-content"
            >
              ⏸ attend ton accord
            </span>
          ) : null}
        </span>
        {children}
      </div>
    </div>
  )
}
