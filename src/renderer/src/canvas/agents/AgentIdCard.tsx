import { useEffect, useMemo, useRef } from 'react'
import { AGENT_ROLE_LABELS, type AgentProfileView } from '@shared/agents/profile'
import { mintCharacter, mintRoom } from './character/mint'
import { drawCharacter, GRID } from './character/portrait'
import { rarer, TIER_LABELS } from './character/random'
import './character/mint.css'

/** Taille de la tête : le personnage en pixels, cadré sur le haut (coiffe et visage). */
const HEAD_W = 56
const HEAD_H = 52
const SCALE = 3

/**
 * Carte d'identité d'un agent (L1o D26) : sa tête en pixels, son nom, son rôle et son rang ; ni chambre ni visio. Le
 * tiroir « Appeler un agent » et les agents posés libres sur la carte la montrent.
 */
export function AgentIdCard({
  profile,
  note
}: {
  readonly profile: AgentProfileView
  /** Petit mot sous le rôle (« à relier »). */
  readonly note?: string
}): React.JSX.Element {
  const character = useMemo(() => mintCharacter(profile.id, profile.role), [profile.id, profile.role])
  const rank = rarer(character.rank, mintRoom(character.seed, profile.delivered).rank)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const target = canvas.current
    const ctx = target?.getContext('2d') ?? null
    if (target === null || ctx === null) return
    target.width = HEAD_W
    target.height = HEAD_H
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, HEAD_W, HEAD_H)
    drawCharacter(ctx, character, SCALE, Math.round((HEAD_W - GRID * SCALE) / 2 / SCALE), -2)
  }, [character])
  return (
    <span className="agent-id-card" data-tier={rank}>
      <canvas ref={canvas} className="agent-id-head" aria-hidden="true" />
      <span className="agent-id-text">
        <span className="agent-id-name">{profile.name}</span>
        <span className="agent-id-role">{AGENT_ROLE_LABELS[profile.role]}</span>
        {note === undefined ? null : <span className="agent-id-note">{note}</span>}
      </span>
      <span className="mint-rank agent-id-rank" data-tier={rank}>
        {TIER_LABELS[rank]}
      </span>
    </span>
  )
}
