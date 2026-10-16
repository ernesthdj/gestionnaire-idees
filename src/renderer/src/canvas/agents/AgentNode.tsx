import { Handle, NodeToolbar, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PASS_NATURE_LABELS } from '@shared/agents/pipeline'
import { AGENT_NODE_SIZE, AGENT_VISUAL_LABELS } from './agentGraph'
import type { AgentNodeType } from './agentTypes'
import { AgentVisioPanel } from './AgentVisioPanel'
import { mintCharacter, mintRoom } from './character/mint'
import { drawCharacter, GRID } from './character/portrait'
import { activityOf } from './room/activity'
import type { RoomHandle } from './room/roomStage'
import { useVisio } from './visioStore'
import './agents.css'

/** Pictogramme d'état, lu par les yeux ; le texte de l'état est dit à côté et aux lecteurs d'écran. */
const STATE_MARK: Readonly<Partial<Record<AgentNodeType['data']['visual'], string>>> = {
  validated: '✓',
  merged: '✓',
  done: '●',
  failed: '✕',
  blocked: '⏸',
  'sent-back': '↺',
  cancelled: '–'
}

/** Largeur du volet de visio et son écart à l'agent : la place que la carte lui laisse en se recentrant. */
const PANEL_ROOM = 384 + 16

/** Au-delà de ce déplacement du pointeur, un clic est un glisser : il n'ouvre pas la visio. */
const CLICK_SLOP = 4

const pad = (n: number): string => String(n).padStart(2, '0')

/** Durée de l'appel, mise à jour chaque seconde. */
function VisioClock({ since }: { readonly since: number }): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  return (
    <span className="agent-visio-clock">
      {pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}
    </span>
  )
}

/** Image de repli (et d'attente du chargement de la 3D) : le personnage en pixels, posé au centre. */
function drawFallback(
  canvas: HTMLCanvasElement,
  draw: (ctx: CanvasRenderingContext2D, s: number, dx: number, dy: number) => void
): void {
  const ctx = canvas.getContext('2d')
  if (ctx === null) return
  const w = canvas.clientWidth || canvas.width
  const h = canvas.clientHeight || canvas.height
  canvas.width = w
  canvas.height = h
  ctx.clearRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = false
  const s = Math.floor(Math.min(w, h) / GRID / 1.6) || 1
  const size = s * GRID
  draw(ctx, s, Math.round((w - size) / 2 / s), Math.round((h - size) / 2 / s))
}

/**
 * Agent connecté à un nœud de la carte (T006, T008 ; L1o D10, D13) : sa chambre-cube en 3D où vit son personnage, qui
 * fait ce que fait l'agent ; dessous, son nom, son état et sa passe, et une barre qui dit où il en est. Il se glisse
 * où l'on veut. Un clic ouvre le volet à côté de lui et le fait passer en visio. Les poignées disent qui attend qui.
 */
export function AgentNode({ id, data }: NodeProps<AgentNodeType>): React.JSX.Element {
  const { visual, name, pass, nature, progress, open, profileId, role, delivered } = data
  const state = AGENT_VISUAL_LABELS[visual]
  const passText = pass === null ? '' : ` · passe ${pass}`
  const inVisio = useVisio((s) => s.key === id)
  const since = useVisio((s) => s.since)
  const talking = useVisio((s) => s.key === id && s.talking)
  const subtitle = useVisio((s) => (s.key === id ? s.subtitle : ''))
  const openVisio = useVisio((s) => s.open)
  const closeVisio = useVisio((s) => s.close)
  const canvas = useRef<HTMLCanvasElement>(null)
  const handle = useRef<RoomHandle | null>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const character = useMemo(() => mintCharacter(profileId, role), [profileId, role])
  // Le travail livré enrichit la chambre, palier par palier.
  const room = useMemo(() => mintRoom(character.seed, delivered), [character, delivered])
  const activity = activityOf(visual)
  // Lus par la chambre une fois chargée (le chargement est asynchrone).
  const wanted = useRef({ activity, inVisio })
  wanted.current = { activity, inVisio }

  // La chambre 3D se charge à la demande ; en attendant, ou sans WebGL, le personnage en pixels.
  useEffect(() => {
    const target = canvas.current
    if (target === null) return
    drawFallback(target, (ctx, s, dx, dy) => drawCharacter(ctx, character, s, dx, dy))
    let alive = true
    void import('./room/roomStage')
      .then(({ mountRoom }) => {
        if (!alive) return
        try {
          const mounted = mountRoom(target, character, room)
          mounted.setActivity(wanted.current.activity)
          mounted.setVisio(wanted.current.inVisio)
          handle.current = mounted
        } catch {
          handle.current = null
        }
      })
      .catch(() => undefined)
    return () => {
      alive = false
      handle.current?.dispose()
      handle.current = null
    }
  }, [character, room])

  useEffect(() => {
    handle.current?.setActivity(activity)
  }, [activity])

  useEffect(() => {
    handle.current?.setVisio(inVisio)
  }, [inVisio])

  useEffect(() => {
    handle.current?.setTalking(talking)
  }, [talking])

  // À l'appel, la carte se recentre sur l'agent (à 100 % au moins, pour bien le voir) en laissant la place du volet.
  const flow = useReactFlow()
  useEffect(() => {
    if (!inVisio) return
    const node = flow.getInternalNode(id)
    if (node === undefined) return
    const zoom = Math.max(flow.getViewport().zoom, 1)
    const at = node.internals.positionAbsolute
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    void flow.setCenter(at.x + AGENT_NODE_SIZE.width / 2 + PANEL_ROOM / 2 / zoom, at.y + AGENT_NODE_SIZE.height / 2, {
      zoom,
      duration: reduced ? 0 : 300
    })
  }, [inVisio, id, flow])

  // L'agent retiré de la carte pendant la visio : l'appel se coupe.
  useEffect(
    () => () => {
      if (useVisio.getState().key === id) closeVisio()
    },
    [id, closeVisio]
  )

  return (
    <div className={`agent-node agent-${visual}${open || inVisio ? ' agent-open' : ''}`} data-visual={visual}>
      <Handle type="target" position={Position.Top} className="agent-handle" />
      <button
        type="button"
        className="agent-room"
        aria-label={`${name}, ${state}${passText}. ${inVisio ? 'En visio : raccrocher.' : 'Ouvrir la visio.'}`}
        aria-pressed={inVisio}
        title={nature === null ? undefined : `${state} — ${PASS_NATURE_LABELS[nature]}`}
        onPointerDown={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY }
        }}
        onClick={(event) => {
          const start = pointer.current
          pointer.current = null
          if (start !== null && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP) return
          if (inVisio) closeVisio()
          else openVisio(id)
        }}
      >
        <canvas ref={canvas} className="agent-room-canvas" aria-hidden="true" />
        {inVisio ? (
          <span className="agent-visio-bar" aria-hidden="true">
            <span className="agent-visio-dot" />
            En visio avec {name}
            <VisioClock since={since} />
          </span>
        ) : null}
        {inVisio && subtitle !== '' ? (
          <span className="agent-visio-subs" aria-hidden="true">
            {subtitle}
          </span>
        ) : null}
      </button>
      <div className="agent-caption">
        <span className="agent-name">{name}</span>
        <span className="agent-state">
          {STATE_MARK[visual] === undefined ? null : <span aria-hidden="true">{STATE_MARK[visual]} </span>}
          {state}
          {passText}
        </span>
        <span
          className="agent-bar"
          role="progressbar"
          aria-label={`Avancement de ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          {...(progress === null ? {} : { 'aria-valuenow': Math.round(progress * 100) })}
        >
          <span
            className={`agent-bar-fill${progress === null ? ' agent-bar-running' : ''}`}
            style={progress === null ? undefined : { width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="agent-handle" />
      <NodeToolbar isVisible={inVisio} position={Position.Right} offset={16} className="agent-visio-toolbar">
        {inVisio ? <AgentVisioPanel data={data} /> : null}
      </NodeToolbar>
    </div>
  )
}
