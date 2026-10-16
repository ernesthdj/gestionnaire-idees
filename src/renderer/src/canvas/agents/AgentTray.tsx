import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { AgentProfileView } from '@shared/agents/profile'
import { AgentIdCard } from './AgentIdCard'

/** Type des données glissées du tiroir vers la carte : l'identifiant du profil. */
export const AGENT_DRAG_TYPE = 'application/x-gi-agent'

const MARGIN = 8

/**
 * Tiroir « Appeler un agent » (L1o D26) : une carte d'identité par profil, dans une liste qui défile. Ouvert dans le
 * vide de la carte (`place`), on glisse une carte sur la carte (ou on clique : l'agent est posé au point du clic
 * droit) ; ouvert sur un nœud (`connect`), un clic connecte l'agent à ce nœud. Échap ou clic ailleurs le referme.
 */
export function AgentTray({
  at,
  mode,
  title,
  profiles,
  onPick,
  onClose
}: {
  readonly at: { readonly x: number; readonly y: number }
  readonly mode: 'place' | 'connect'
  /** Nœud visé en mode `connect`. */
  readonly title?: string
  readonly profiles: readonly AgentProfileView[]
  readonly onPick: (profile: AgentProfileView) => void
  readonly onClose: () => void
}): React.JSX.Element {
  const tray = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [place, setPlace] = useState(at)
  useLayoutEffect(() => {
    const box = tray.current?.getBoundingClientRect()
    if (box === undefined) return
    setPlace({
      x: Math.max(MARGIN, Math.min(at.x, window.innerWidth - box.width - MARGIN)),
      y: Math.max(MARGIN, Math.min(at.y, window.innerHeight - box.height - MARGIN))
    })
  }, [at])
  useEffect(() => {
    tray.current?.querySelector<HTMLElement>('button')?.focus()
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Node && tray.current?.contains(event.target) === true) return
      onClose()
    }
    window.addEventListener('pointerdown', outside)
    return () => window.removeEventListener('pointerdown', outside)
  }, [onClose])
  return (
    <div
      ref={tray}
      role="dialog"
      aria-labelledby={titleId}
      className="agent-tray nodrag nowheel"
      style={{ left: place.x, top: place.y }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <h2 id={titleId} className="agent-tray-title">
        {mode === 'connect' ? `Connecter un agent à « ${title ?? 'ce nœud'} »` : 'Appeler un agent'}
      </h2>
      <p className="agent-tray-hint">
        {mode === 'connect'
          ? 'Clique sur un agent : il rejoint ce nœud.'
          : 'Glisse un agent sur la carte (ou clique : il se pose ici), puis tire un lien de lui vers une tâche.'}
      </p>
      {profiles.length === 0 ? (
        <p className="agent-tray-hint">Aucun profil d’agent : crée-en dans Skills › Profils d’agents.</p>
      ) : (
        <ul className="agent-tray-list">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                className="agent-tray-card"
                draggable={mode === 'place'}
                aria-label={`${mode === 'connect' ? 'Connecter' : 'Poser'} ${profile.name}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData(AGENT_DRAG_TYPE, profile.id)
                  event.dataTransfer.effectAllowed = 'copy'
                }}
                onDragEnd={(event) => {
                  if (event.dataTransfer.dropEffect !== 'none') onClose()
                }}
                onClick={() => onPick(profile)}
              >
                <AgentIdCard profile={profile} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
