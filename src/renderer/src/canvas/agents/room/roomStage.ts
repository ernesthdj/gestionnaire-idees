import * as THREE from 'three'
import type { AgentCharacter, AgentRoom } from '../character/mint'
import { RoomScene, type RoomActivity } from './RoomScene'

/**
 * Scène partagée des chambres d'agents (T008, L1o D13) : un seul contexte WebGL pour toute la carte. Chaque chambre
 * visible est dessinée tour à tour dans ce renderer puis copiée dans le canevas 2D de son nœud ; une chambre hors de
 * l'écran ne coûte rien. 30 images par seconde au plus, et au plus `PER_TICK` chambres par image (les autres attendent
 * leur tour) ; mouvement réduit : une seule image, refaite quand l'état change.
 */

/** Nombre de chambres redessinées à chaque image : au-delà, elles se partagent les images à tour de rôle. */
const PER_TICK = 4
const FRAME_MS = 33

export interface RoomHandle {
  setActivity(activity: RoomActivity): void
  setVisio(on: boolean): void
  setTalking(on: boolean): void
  dispose(): void
}

interface Entry {
  readonly scene: RoomScene
  readonly target: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  visible: boolean
  /** Une image est due (mouvement réduit, ou changement d'état). */
  dirty: boolean
  last: number
}

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

let renderer: THREE.WebGLRenderer | null = null
let observer: IntersectionObserver | null = null
const entries = new Set<Entry>()
const byTarget = new Map<Element, Entry>()
let cursor = 0
let frame = 0
let lastTick = 0

function ensureRenderer(): THREE.WebGLRenderer {
  if (renderer !== null) return renderer
  const created = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  created.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
  created.shadowMap.enabled = true
  created.shadowMap.type = THREE.PCFSoftShadowMap
  created.shadowMap.autoUpdate = false
  created.autoClear = false
  renderer = created
  return created
}

function draw(entry: Entry, t: number): void {
  const r = ensureRenderer()
  const w = entry.target.clientWidth
  const h = entry.target.clientHeight
  if (w === 0 || h === 0) return
  const ratio = r.getPixelRatio()
  const pw = Math.round(w * ratio)
  const ph = Math.round(h * ratio)
  const size = r.getSize(new THREE.Vector2())
  if (size.x < w || size.y < h) r.setSize(Math.max(size.x, w), Math.max(size.y, h), false)
  if (entry.target.width !== pw || entry.target.height !== ph) {
    entry.target.width = pw
    entry.target.height = ph
  }
  const dt = Math.min(0.05, entry.last === 0 ? 0 : (t - entry.last) / 1000)
  entry.last = t
  entry.scene.update(t, dt)
  entry.scene.render(r, w, h)
  // Le dessin WebGL est en bas à gauche du tampon : on n'en copie que la part de cette chambre.
  const bufferHeight = r.domElement.height
  entry.ctx.clearRect(0, 0, pw, ph)
  entry.ctx.drawImage(r.domElement, 0, bufferHeight - ph, pw, ph, 0, 0, pw, ph)
  entry.dirty = false
}

function tick(t: number): void {
  frame = entries.size === 0 ? 0 : requestAnimationFrame(tick)
  if (document.hidden || t - lastTick < FRAME_MS) return
  lastTick = t
  const reduced = reducedMotion()
  const due = [...entries].filter((entry) => entry.visible && (!reduced || entry.dirty))
  if (due.length === 0) return
  const count = Math.min(PER_TICK, due.length)
  for (let i = 0; i < count; i++) {
    const entry = due[(cursor + i) % due.length]
    if (entry !== undefined) draw(entry, t)
  }
  cursor = (cursor + count) % due.length
}

function ensureLoop(): void {
  if (frame === 0) frame = requestAnimationFrame(tick)
}

function ensureObserver(): IntersectionObserver {
  if (observer !== null) return observer
  observer = new IntersectionObserver((seen) => {
    for (const item of seen) {
      const entry = byTarget.get(item.target)
      if (entry !== undefined) {
        entry.visible = item.isIntersecting
        if (entry.visible) entry.dirty = true
      }
    }
  })
  return observer
}

/**
 * Accroche une chambre au canevas d'un nœud. Lève une erreur si WebGL n'est pas disponible (le nœud garde alors son
 * portrait en 2D).
 */
export function mountRoom(
  target: HTMLCanvasElement,
  character: AgentCharacter,
  room: AgentRoom,
  options: { readonly inset?: boolean } = {}
): RoomHandle {
  ensureRenderer()
  const ctx = target.getContext('2d')
  if (ctx === null) throw new Error('Canvas 2D indisponible.')
  const entry: Entry = {
    scene: new RoomScene(character, room, reducedMotion(), options.inset ?? true),
    target,
    ctx,
    visible: true,
    dirty: true,
    last: 0
  }
  entries.add(entry)
  byTarget.set(target, entry)
  ensureObserver().observe(target)
  ensureLoop()
  const now = (): number => performance.now()
  return {
    setActivity: (activity) => {
      entry.scene.setActivity(activity, now())
      entry.dirty = true
    },
    setVisio: (on) => {
      entry.scene.setVisio(on, now())
      entry.dirty = true
    },
    setTalking: (on) => entry.scene.setTalking(on),
    dispose: () => {
      observer?.unobserve(target)
      byTarget.delete(target)
      entries.delete(entry)
      entry.scene.dispose()
      if (entries.size === 0) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }
  }
}
