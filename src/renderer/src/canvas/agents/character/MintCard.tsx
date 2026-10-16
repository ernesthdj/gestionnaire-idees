import { useEffect, useMemo, useRef } from 'react'
import type { AgentRole } from '@shared/agents/profile'
import type { RoomHandle } from '../room/roomStage'
import { mintCharacter, mintRoom } from './mint'
import { drawCharacter, GRID } from './portrait'
import { rarer, TIER_LABELS, type Tier } from './random'
import './mint.css'

/**
 * Carte de l'agent minté (L1o D21) : sa chambre-cube où vit son personnage, chaque calque avec sa rareté, et son rang.
 * À la création, elle se révèle (la chambre apparaît, puis les calques un à un, puis le rang) ; `minting` joue l'éclat
 * de la naissance. Mouvement réduit : tout est affiché d'un coup.
 */
export function MintCard({
  profileId,
  role,
  name,
  delivered = 0,
  reveal = false,
  minting = false
}: {
  readonly profileId: string
  readonly role: AgentRole | null
  readonly name: string
  readonly delivered?: number
  readonly reveal?: boolean
  readonly minting?: boolean
}): React.JSX.Element {
  const character = useMemo(() => mintCharacter(profileId, role), [profileId, role])
  const room = useMemo(() => mintRoom(character.seed, delivered), [character, delivered])
  const rank = rarer(character.rank, room.rank)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const target = canvas.current
    if (target === null) return undefined
    const ctx = target.getContext('2d')
    if (ctx !== null) {
      target.width = target.clientWidth || 224
      target.height = target.clientHeight || 196
      ctx.imageSmoothingEnabled = false
      const s = Math.floor(Math.min(target.width, target.height) / GRID / 1.6) || 1
      const size = s * GRID
      drawCharacter(
        ctx,
        character,
        s,
        Math.round((target.width - size) / 2 / s),
        Math.round((target.height - size) / 2 / s)
      )
    }
    let alive = true
    let handle: RoomHandle | null = null
    void import('../room/roomStage')
      .then(({ mountRoom }) => {
        if (!alive) return
        try {
          handle = mountRoom(target, character, room)
          handle.setActivity('libre')
        } catch {
          handle = null
        }
      })
      .catch(() => undefined)
    return () => {
      alive = false
      handle?.dispose()
    }
  }, [character, room])

  const layers: readonly (readonly [string, string, Tier])[] = [
    ['Univers', character.universe.name, character.universe.tier],
    ['Silhouette', character.base.name, character.base.tier],
    ['Yeux', character.yeux.name, character.yeux.tier],
    ['Coiffe', character.coiffe.name, character.coiffe.tier],
    ['Objet', character.objet.name, character.objet.tier],
    ['Chambre', `rang ${TIER_LABELS[room.rank]}`, room.rank]
  ]
  return (
    <section
      aria-label={`Agent minté : ${name.trim() === '' ? 'sans nom' : name}, ${character.base.name}, rang ${TIER_LABELS[rank]}`}
      className={`mint-card${reveal ? ' mint-reveal' : ''}${minting ? ' mint-minting' : ''}`}
      data-tier={rank}
    >
      <canvas ref={canvas} className="mint-room" aria-hidden="true" />
      <div className="mint-info">
        <p className="mint-title">
          <span className="truncate">{name.trim() === '' ? 'Nouvel agent' : name}</span>
          <span className="mint-rank" data-tier={rank}>
            {TIER_LABELS[rank]}
          </span>
        </p>
        <ul className="mint-traits">
          {layers.map(([label, value, tier], index) => (
            <li key={label} data-tier={tier} style={{ '--i': index } as React.CSSProperties}>
              <span className="text-content-muted">{label} : </span>
              {value}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
