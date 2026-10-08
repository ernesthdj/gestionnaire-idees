import { Pin, PinOff } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import type { CardHead } from './cardContent'
import type { Offset, OpenCard } from './cardsStore'
import './cards.css'

/** Hauteur du trait entre le nœud et la carte, depuis le haut de la carte (unités de la carte). */
export const CARD_STEM_Y = 28
/** Écart entre le bord droit du nœud et la carte. */
export const CARD_GAP = 18

/** Boîte d'un nœud dans la carte (coin haut gauche et taille, unités de la carte). */
export interface NodeBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface DetailCardProps {
  readonly card: OpenCard
  readonly active: boolean
  /** Boîte du nœud ; `null` tant qu'il n'est pas mesuré. */
  readonly anchor: NodeBox | null
  readonly zoom: number
  readonly head: CardHead
  /** Nœuds liés (cliquables : on passe à leur carte). */
  readonly related?: readonly { readonly id: string; readonly title: string }[]
  /** Rubrique « Fichiers » (liste propre à la sorte de nœud). */
  readonly files?: ReactNode
  /** Gestes propres à la sorte de nœud (action finale, ✓ / ✗, lire…). */
  readonly actions?: ReactNode
  /** Contenu de la fiche (étirement vers le bas) ; absent : pas de bouton « Fiche ». */
  readonly sheet?: ReactNode
  readonly sheetLabel?: string
  /** La sorte de nœud a une conversation (« Discuter »). */
  readonly canChat: boolean
  /** Contenu de l'étirement de droite (discussion ou lecteur), quand il est ouvert. */
  readonly side?: ReactNode
  readonly fold?: {
    readonly collapsed: boolean
    readonly count: number
    readonly onToggle: () => void
    /** Ce que le repli cache : « sous-étapes » (plan), « sous-éléments » (carte de structure). */
    readonly noun?: string
  }
  readonly onActivate: () => void
  readonly onClose: () => void
  readonly onMove: (offset: Offset) => void
  readonly onToggleSheet: () => void
  /** Épingler / détacher (D28). */
  readonly onTogglePin: () => void
  readonly onToggleChat: () => void
  /** Échap : replie d'abord le lecteur, puis ferme la carte. */
  readonly onEscape: () => void
  readonly onGoto: (id: string) => void
}

/** Six points : la zone à saisir pour déplacer la carte. */
function Grip(): React.JSX.Element {
  return (
    <svg className="card-grip" width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="3" r="1.5" />
      <circle cx="7.5" cy="3" r="1.5" />
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="7.5" cy="8" r="1.5" />
      <circle cx="2.5" cy="13" r="1.5" />
      <circle cx="7.5" cy="13" r="1.5" />
    </svg>
  )
}

/**
 * Carte de détails d'un nœud (spec 022 D5, D6, D10, D15, D16, D18) : posée à droite de son nœud dans la couche de la
 * carte (elle le suit et subit le zoom), reliée par un trait ; en-tête déplaçable (poignée), ✕ ; statut, résumé,
 * jauge, nœuds liés, fichiers, gestes ; « Fiche » s'étire vers le bas, « Discuter » ou un fichier vers la droite.
 * Plusieurs cartes peuvent être ouvertes : la carte active passe devant.
 */
export function DetailCard(props: DetailCardProps): React.JSX.Element | null {
  const {
    card,
    active,
    anchor,
    zoom,
    head,
    related = [],
    files,
    actions,
    sheet,
    sheetLabel = 'Fiche',
    side,
    fold
  } = props
  const root = useRef<HTMLElement>(null)
  const tether = useRef<SVGPathElement>(null)
  // À l'ouverture (et seulement là), le focus entre dans la carte : Entrée sur un nœud, puis Tab dans la carte.
  const openedActive = useRef(active)
  useEffect(() => {
    if (openedActive.current) root.current?.focus({ preventScroll: true })
  }, [])
  if (anchor === null) return null

  const left = anchor.x + anchor.width + CARD_GAP + card.offset.x
  const top = anchor.y + anchor.height / 2 - CARD_STEM_Y + card.offset.y
  const moved = card.offset.x !== 0 || card.offset.y !== 0
  const center = { x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 }
  const stem = { x: left, y: top + CARD_STEM_Y }

  // Glisser par l'en-tête : le déplacement à l'écran, ramené aux unités de la carte, s'ajoute au décalage.
  const startDrag = (event: React.PointerEvent): void => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button') !== null)) return
    event.preventDefault()
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const start = { x: event.clientX, y: event.clientY }
    let delta = { x: 0, y: 0 }
    let frame = 0
    // Pendant le glisser, la carte se déplace directement à l'écran (une transformation par image, sans redessiner la
    // carte ni sa discussion) ; sa nouvelle place n'est enregistrée qu'au lâcher.
    const paint = (): void => {
      frame = 0
      const section = root.current
      if (section !== null) section.style.translate = `${delta.x}px ${delta.y}px`
      const path = tether.current
      if (path !== null) {
        const end = { x: stem.x + delta.x, y: stem.y + delta.y }
        const mid = (center.x + end.x) / 2
        path.setAttribute('d', `M${center.x},${center.y} C${mid},${center.y} ${mid},${end.y} ${end.x},${end.y}`)
      }
    }
    const move = (next: PointerEvent): void => {
      delta = { x: (next.clientX - start.x) / zoom, y: (next.clientY - start.y) / zoom }
      if (frame === 0) frame = requestAnimationFrame(paint)
    }
    const up = (): void => {
      cancelAnimationFrame(frame)
      target.removeEventListener('pointermove', move as EventListener)
      target.removeEventListener('pointerup', up)
      if (root.current !== null) root.current.style.translate = ''
      if (delta.x !== 0 || delta.y !== 0) props.onMove({ x: card.offset.x + delta.x, y: card.offset.y + delta.y })
    }
    target.addEventListener('pointermove', move as EventListener)
    target.addEventListener('pointerup', up)
  }

  return (
    <>
      {moved ? (
        <svg className="card-tether" aria-hidden="true">
          <path
            ref={tether}
            d={`M${center.x},${center.y} C${(center.x + stem.x) / 2},${center.y} ${(center.x + stem.x) / 2},${stem.y} ${stem.x},${stem.y}`}
          />
        </svg>
      ) : null}
      <section
        ref={root}
        role="dialog"
        aria-label={`Détails : ${head.title}`}
        tabIndex={-1}
        className={`detail-card nodrag nopan nowheel${active ? ' detail-card-active' : ''}${moved ? ' detail-card-moved' : ''}${card.pinned ? ' detail-card-pinned' : ''}`}
        // La couche de la carte de React Flow ignore la souris (`pointer-events: none`, seuls les nœuds la
        // réactivent) : la carte la réactive pour elle-même, sinon clics, saisie et glisser la traversent.
        style={{ left, top, zIndex: 1000 + card.z, pointerEvents: 'all' }}
        onPointerDownCapture={props.onActivate}
        onFocusCapture={props.onActivate}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          props.onEscape()
        }}
      >
        <div className="detail-card-main">
          <header
            className="detail-card-head"
            onPointerDown={startDrag}
            onDoubleClick={(event) => {
              if (event.target instanceof Element && event.target.closest('button') !== null) return
              props.onMove({ x: 0, y: 0 })
            }}
            title="Glisser pour déplacer la carte (double-clic : la recoller)"
          >
            <Grip />
            <span className="detail-card-badge">{head.badge}</span>
            {head.meta === null ? null : <span className="detail-card-meta">{head.meta}</span>}
            <button
              type="button"
              className="detail-card-pin"
              aria-pressed={card.pinned}
              aria-label={card.pinned ? 'Détacher la carte' : 'Épingler la carte'}
              title={
                card.pinned
                  ? 'Épinglée : elle reste ouverte malgré un clic à l’extérieur'
                  : 'Épingler : garder la carte ouverte malgré un clic à l’extérieur'
              }
              onClick={props.onTogglePin}
            >
              {card.pinned ? <PinOff aria-hidden="true" size={14} /> : <Pin aria-hidden="true" size={14} />}
            </button>
            <button type="button" className="detail-card-close" aria-label="Fermer la carte" onClick={props.onClose}>
              ✕
            </button>
          </header>
          <h2 className="detail-card-title">{head.title}</h2>
          {head.summary === null ? null : <p className="detail-card-summary">{head.summary}</p>}
          {head.gauge === null ? null : (
            <div className="detail-card-section">
              <div className="detail-card-row">
                <span>{head.gauge.label}</span>
                <span>{head.gauge.text}</span>
              </div>
              <div
                className="detail-card-gauge"
                role="meter"
                aria-label={head.gauge.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={head.gauge.value}
                aria-valuetext={head.gauge.text}
              >
                <span style={{ width: `${head.gauge.value}%` }} />
              </div>
            </div>
          )}
          {related.length === 0 ? null : (
            <div className="detail-card-section">
              <div className="detail-card-row">
                <span>Liés</span>
                <span>{related.length}</span>
              </div>
              <div className="detail-card-related">
                {related.map((node) => (
                  <button key={node.id} type="button" onClick={() => props.onGoto(node.id)}>
                    {node.title} →
                  </button>
                ))}
              </div>
            </div>
          )}
          {files === undefined ? null : (
            <div className="detail-card-section">
              <div className="detail-card-row">
                <span>Fichiers</span>
              </div>
              {files}
            </div>
          )}
          {sheet === undefined || !card.sheet ? null : <div className="detail-card-sheet">{sheet}</div>}
          <div className="detail-card-actions">
            {sheet === undefined ? null : (
              <button
                type="button"
                className="card-button card-button-ghost"
                aria-pressed={card.sheet}
                onClick={props.onToggleSheet}
              >
                {sheetLabel}
              </button>
            )}
            {props.canChat ? (
              <button
                type="button"
                className="card-button card-button-primary"
                aria-pressed={card.side === 'chat'}
                onClick={props.onToggleChat}
              >
                Discuter
              </button>
            ) : null}
          </div>
          {actions === undefined ? null : <div className="detail-card-extra">{actions}</div>}
          {fold === undefined || fold.count === 0 ? null : (
            <button type="button" className="card-button card-button-ghost detail-card-fold" onClick={fold.onToggle}>
              {fold.collapsed ? 'Afficher' : 'Masquer'} les {fold.noun ?? 'sous-étapes'} ({fold.count})
            </button>
          )}
        </div>
        {side === undefined || card.side === null ? null : (
          <div className={`detail-card-side detail-card-side-${card.side}`}>{side}</div>
        )}
      </section>
    </>
  )
}
