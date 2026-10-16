import * as THREE from 'three'
import { rng } from '../character/random'
import type { AgentRoom, RoomSlot } from '../character/mint'
import type { UniverseKey } from '../character/sprites'

/**
 * Chambre-cube d'un agent en Three.js (T008, L1o D13), reprise de la planche `docs/design/agents/dioramas-3d.html` :
 * sol, murs, bureau, lit, coin sport, déco, plan au mur et ambiance, chacun selon le calque tiré. Les couleurs sont
 * celles des meubles dessinés, pas des jetons du thème.
 */

/** Arête du cube (unités de la scène) et sa moitié. */
export const C = 36
export const HALF = C / 2

export interface RoomStyle {
  readonly floor: number
  readonly wall: readonly [string, string]
  readonly wood: number
  readonly bed: number
  readonly blanket: number
  readonly metal: number
  readonly rug: number
  readonly accent: number
  readonly doodle: string
}

/** Un style de meubles par univers. */
export const STYLES: Readonly<Record<UniverseKey, RoomStyle>> = {
  robots: {
    floor: 0x5b6478,
    wall: ['#c9d0db', '#aeb7c6'],
    wood: 0x8f99ac,
    bed: 0x3fb6a8,
    blanket: 0x2a3040,
    metal: 0x4d566a,
    rug: 0xf2b630,
    accent: 0x36d1f2,
    doodle: '#7d879a'
  },
  sf: {
    floor: 0x2c2550,
    wall: ['#1c1838', '#2a2454'],
    wood: 0xeef1f6,
    bed: 0x6ff3ff,
    blanket: 0x9b6bff,
    metal: 0x9aa3b5,
    rug: 0x9b6bff,
    accent: 0x6ff3ff,
    doodle: '#6ff3ff'
  },
  fantasy: {
    floor: 0x8a6a45,
    wall: ['#d8c8a8', '#bfa982'],
    wood: 0x8a5a2b,
    bed: 0x5b2a8c,
    blanket: 0xd9363e,
    metal: 0x9aa3b5,
    rug: 0x2f6b2a,
    accent: 0xf2c14e,
    doodle: '#8a6a45'
  },
  wtf: {
    floor: 0xffd84a,
    wall: ['#ff9ad5', '#8ee6c4'],
    wood: 0xff8c1a,
    bed: 0x3b7ff0,
    blanket: 0x7ed957,
    metal: 0xe5484d,
    rug: 0x9b6bff,
    accent: 0xff2fb0,
    doodle: '#ffffff'
  }
}

/** Ce que la scène anime et lit de la chambre construite. */
export interface BuiltRoom {
  readonly group: THREE.Group
  /** Écran du bureau : redessiné selon l'activité. */
  readonly screen: HTMLCanvasElement
  readonly screenTexture: THREE.CanvasTexture
  /** Hauteur où l'agent s'allonge, et hauteur de ses sauts au coin sport. */
  readonly lieY: number
  readonly jump: number
  /** Animations des meubles (aquarium, néons, bougies…), appelées à chaque image. */
  readonly animated: readonly ((t: number) => void)[]
  /** Le punching-ball bouge plus fort quand l'agent fait du sport. */
  sporting: boolean
}

export const mat = (
  c: number | THREE.Color,
  extra: THREE.MeshLambertMaterialParameters = {}
): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color: c, ...extra })

export function boxM(
  w: number,
  h: number,
  d: number,
  c: number,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D,
  extra?: THREE.MeshLambertMaterialParameters
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, extra))
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  if (x === null) throw new Error('Canvas 2D indisponible.')
  return [c, x]
}

const hex = (color: number): string => `#${new THREE.Color(color).getHexString()}`

function wallCanvas(st: RoomStyle, seed: number): HTMLCanvasElement {
  const [c, x] = canvas2d(256, 256)
  const r = rng(seed)
  const g = x.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, st.wall[0])
  g.addColorStop(1, st.wall[1])
  x.fillStyle = g
  x.fillRect(0, 0, 256, 256)
  x.strokeStyle = st.doodle
  x.fillStyle = st.doodle
  x.globalAlpha = 0.35
  x.lineWidth = 2
  for (let k = 0; k < 9; k++) {
    const px = r() * 256
    const py = r() * 200 + 20
    x.beginPath()
    x.arc(px, py, 5, 0, 7)
    x.fill()
    for (let j = 0; j < 4; j++) {
      const ang = r() * 7
      x.beginPath()
      x.moveTo(px, py)
      x.lineTo(px + Math.cos(ang) * 14, py + Math.sin(ang) * 14)
      x.stroke()
    }
  }
  x.globalAlpha = 0.18
  for (let y = 210; y < 256; y += 6) x.fillRect(0, y, 256, 2)
  return c
}

function paperCanvas(kind: string, st: RoomStyle, seed: number): HTMLCanvasElement {
  if (kind === 'Motif du thème') return wallCanvas(st, seed)
  const [c, x] = canvas2d(256, 256)
  const r = rng(seed)
  if (kind === 'Rayures') {
    for (let i = 0; i < 16; i++) {
      x.fillStyle = i % 2 ? st.wall[0] : st.wall[1]
      x.fillRect(i * 16, 0, 16, 256)
    }
  }
  if (kind === 'Pois') {
    x.fillStyle = st.wall[0]
    x.fillRect(0, 0, 256, 256)
    x.fillStyle = st.doodle
    x.globalAlpha = 0.45
    for (let y = 12; y < 256; y += 28)
      for (let i = (y / 28) % 2 ? 14 : 0; i < 256; i += 28) {
        x.beginPath()
        x.arc(i, y, 5, 0, 7)
        x.fill()
      }
  }
  if (kind === 'Briques') {
    x.fillStyle = '#b8614a'
    x.fillRect(0, 0, 256, 256)
    x.fillStyle = '#e8d6c8'
    for (let y = 0; y < 256; y += 16) {
      x.fillRect(0, y, 256, 2)
      for (let i = (y / 16) % 2 ? 0 : 16; i < 256; i += 32) x.fillRect(i, y, 2, 16)
    }
  }
  if (kind === 'Ciel étoilé') {
    const g = x.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#0b0b25')
    g.addColorStop(1, '#2b1a5a')
    x.fillStyle = g
    x.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 70; i++) {
      x.fillStyle = i % 6 ? '#c9d2ff' : '#ffe48a'
      x.fillRect(r() * 256, r() * 256, 2, 2)
    }
    x.fillStyle = '#ffe9a8'
    x.beginPath()
    x.arc(200, 50, 18, 0, 7)
    x.fill()
  }
  if (kind === 'Aquarelle arc-en-ciel') {
    const g = x.createLinearGradient(0, 0, 256, 256)
    ;['#ff9ad5', '#ffd24a', '#8ee6c4', '#8cc8ff', '#b9a3ff'].forEach((col, i) => g.addColorStop(i / 4, col))
    x.fillStyle = g
    x.fillRect(0, 0, 256, 256)
    x.globalAlpha = 0.25
    for (let i = 0; i < 18; i++) {
      x.fillStyle = '#ffffff'
      x.beginPath()
      x.arc(r() * 256, r() * 256, 10 + r() * 30, 0, 7)
      x.fill()
    }
  }
  return c
}

function floorCanvas(kind: string, st: RoomStyle): HTMLCanvasElement {
  const [c, x] = canvas2d(256, 256)
  const base = hex(st.floor)
  if (kind === 'Parquet') {
    for (let i = 0; i < 16; i++) {
      x.fillStyle = i % 2 ? '#d9b98c' : '#cfab7a'
      x.fillRect(0, i * 16, 256, 16)
      x.fillStyle = '#b8935f'
      x.fillRect((i * 67) % 256, i * 16, 2, 16)
    }
  }
  if (kind === 'Carrelage' || kind === 'Damier doré') {
    const [a, b] = kind === 'Carrelage' ? ['#ffffff', base] : ['#f2c14e', '#2b2540']
    for (let y = 0; y < 8; y++)
      for (let i = 0; i < 8; i++) {
        x.fillStyle = (i + y) % 2 ? a : b
        x.fillRect(i * 32, y * 32, 32, 32)
      }
  }
  if (kind === 'Moquette') {
    x.fillStyle = base
    x.fillRect(0, 0, 256, 256)
    x.globalAlpha = 0.12
    for (let i = 0; i < 1200; i++) {
      x.fillStyle = i % 2 ? '#000' : '#fff'
      x.fillRect((i * 97) % 256, (i * 53) % 256, 2, 2)
    }
  }
  if (kind === 'Herbe') {
    x.fillStyle = '#5fae4a'
    x.fillRect(0, 0, 256, 256)
    x.fillStyle = '#7ed957'
    for (let i = 0; i < 500; i++) x.fillRect((i * 131) % 256, (i * 71) % 256, 2, 5)
  }
  if (kind === 'Nuages') {
    x.fillStyle = '#bfe3ff'
    x.fillRect(0, 0, 256, 256)
    x.fillStyle = '#ffffff'
    for (let i = 0; i < 26; i++) {
      x.beginPath()
      x.arc((i * 89) % 256, (i * 47) % 256, 18 + (i % 4) * 6, 0, 7)
      x.fill()
    }
  }
  return c
}

const texOf = (cv: HTMLCanvasElement, rep = 1): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rep, rep)
  return t
}

/** Écran du bureau : code qui défile au travail, « ERR » en erreur, en veille sinon. */
export function drawScreen(screen: HTMLCanvasElement, mode: 'travail' | 'erreur' | 'veille', t: number): void {
  const x = screen.getContext('2d')
  if (x === null) return
  x.fillStyle = mode === 'erreur' ? '#5a0f14' : mode === 'travail' ? '#101a2e' : '#1a1f2e'
  x.fillRect(0, 0, 128, 80)
  if (mode === 'erreur') {
    x.fillStyle = '#ff5c5c'
    x.font = 'bold 28px monospace'
    x.fillText('ERR', 34, 50)
    return
  }
  if (mode === 'veille') {
    x.fillStyle = '#2a3350'
    x.fillRect(10, 10, 108, 60)
    return
  }
  const cols = ['#3ee8a8', '#6c9cf3', '#f2b630', '#c084fc']
  const off = Math.floor(t / 180)
  for (let k = 0; k < 7; k++) {
    x.fillStyle = cols[(k + off) % 4] ?? '#3ee8a8'
    x.fillRect(8 + ((k + off) % 3) * 8, 8 + k * 10, 30 + ((k * 37 + off * 13) % 70), 5)
  }
}

interface BoardSupport {
  readonly bg: string
  readonly ink: string
  readonly alt: string
  readonly frame: number | null
  readonly glow?: boolean
  readonly holo?: boolean
  readonly notes?: boolean
}

const SUPPORTS: Readonly<Record<string, BoardSupport>> = {
  'Tableau blanc': { bg: '#ffffff', ink: '#3b7ff0', alt: '#e5484d', frame: 0x9aa3b5 },
  'Liège à punaises': { bg: '#c89a62', ink: '#3a2a1a', alt: '#e5484d', frame: 0x6b4a2b, notes: true },
  'Tableau noir': { bg: '#2f4a3a', ink: '#f2f2ea', alt: '#ffd24a', frame: 0x7a5530 },
  'Écran mural': { bg: '#0d1424', ink: '#4ad7ff', alt: '#ff5fa8', frame: 0x1a1f2b, glow: true },
  Hologramme: { bg: 'rgba(60,200,255,0.18)', ink: '#8ef4ff', alt: '#ffffff', frame: null, glow: true, holo: true },
  Parchemin: { bg: '#efd9a8', ink: '#6b3d1a', alt: '#b3261e', frame: 0x8a5a2b }
}

/** Plan au mur : le support (deux couleurs, cadre) et le schéma dessiné dessus. */
function boardCanvas(support: string, schema: string, SUP: BoardSupport): HTMLCanvasElement {
  const [c, bx] = canvas2d(256, 160)
  bx.fillStyle = SUP.bg
  bx.fillRect(0, 0, 256, 160)
  if (support === 'Liège à punaises') {
    bx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let k = 0; k < 220; k++) bx.fillRect((k * 53) % 256, (k * 31) % 160, 2, 2)
  }
  if (support === 'Parchemin') {
    bx.fillStyle = 'rgba(120,70,20,0.18)'
    bx.fillRect(0, 0, 256, 10)
    bx.fillRect(0, 150, 256, 10)
  }
  bx.strokeStyle = SUP.ink
  bx.fillStyle = SUP.ink
  bx.lineWidth = 5
  bx.lineCap = 'round'
  bx.lineJoin = 'round'
  const line = (pts: readonly (readonly [number, number])[]): void => {
    bx.beginPath()
    pts.forEach(([x, y], i) => (i ? bx.lineTo(x, y) : bx.moveTo(x, y)))
    bx.stroke()
  }
  const dot = (x: number, y: number, r: number): void => {
    bx.beginPath()
    bx.arc(x, y, r, 0, Math.PI * 2)
    bx.fill()
  }
  if (schema === 'Deux boîtes') {
    bx.strokeRect(30, 40, 60, 40)
    bx.strokeRect(160, 40, 60, 40)
    line([
      [90, 60],
      [160, 60]
    ])
    bx.fillStyle = SUP.alt
    bx.font = 'bold 30px sans-serif'
    bx.fillText('?', 118, 120)
  }
  if (schema === 'Liste cochée')
    for (let k = 0; k < 4; k++) {
      const y = 30 + k * 32
      bx.strokeRect(30, y - 10, 18, 18)
      line([
        [64, y],
        [64 + 110 - k * 18, y]
      ])
      if (k < 2) {
        bx.strokeStyle = SUP.alt
        line([
          [32, y],
          [38, y + 6],
          [50, y - 12]
        ])
        bx.strokeStyle = SUP.ink
      }
    }
  if (schema === 'Courbe qui monte') {
    line([
      [30, 20],
      [30, 135],
      [230, 135]
    ])
    bx.strokeStyle = SUP.alt
    line([
      [40, 120],
      [80, 105],
      [115, 112],
      [150, 80],
      [185, 70],
      [220, 30]
    ])
    line([
      [205, 30],
      [220, 30],
      [216, 45]
    ])
  }
  if (schema === 'Carte mentale') {
    const center: readonly [number, number] = [128, 80]
    const branches: readonly (readonly [number, number])[] = [
      [45, 30],
      [210, 30],
      [40, 130],
      [215, 128],
      [128, 18]
    ]
    branches.forEach(([x, y]) => {
      line([center, [x, y]])
      dot(x, y, 9)
    })
    bx.fillStyle = SUP.alt
    dot(center[0], center[1], 16)
  }
  if (schema === 'Planning en barres') {
    bx.lineWidth = 3
    line([
      [30, 20],
      [30, 140]
    ])
    const bars: readonly (readonly [number, number])[] = [
      [40, 90],
      [80, 150],
      [120, 200],
      [70, 230]
    ]
    bars.forEach(([a0, a1], k) => {
      bx.fillStyle = k % 2 ? SUP.alt : SUP.ink
      bx.fillRect(a0, 28 + k * 28, a1 - a0, 16)
    })
  }
  if (schema === 'Constellation de neurones') {
    const n: readonly (readonly [number, number])[] = [
      [40, 40],
      [90, 110],
      [130, 50],
      [180, 120],
      [215, 45],
      [160, 85]
    ]
    bx.lineWidth = 2
    const edges: readonly (readonly [number, number])[] = [
      [0, 2],
      [2, 1],
      [1, 3],
      [2, 5],
      [5, 3],
      [5, 4],
      [2, 4]
    ]
    edges.forEach(([i, j]) => {
      const a = n[i]
      const b = n[j]
      if (a !== undefined && b !== undefined) line([a, b])
    })
    n.forEach(([x, y], k) => {
      bx.fillStyle = k === 5 ? SUP.alt : SUP.ink
      dot(x, y, k === 5 ? 10 : 7)
    })
  }
  if (schema === 'Carte au trésor') {
    bx.setLineDash([8, 9])
    line([
      [30, 130],
      [70, 100],
      [60, 60],
      [120, 70],
      [160, 40],
      [200, 60]
    ])
    bx.setLineDash([])
    bx.strokeStyle = SUP.alt
    bx.lineWidth = 7
    line([
      [192, 52],
      [212, 72]
    ])
    line([
      [212, 52],
      [192, 72]
    ])
  }
  if (SUP.notes === true) {
    bx.fillStyle = '#ffd24a'
    bx.fillRect(200, 18, 34, 30)
    bx.fillStyle = '#7ee08a'
    bx.fillRect(14, 116, 34, 30)
    bx.fillStyle = '#e5484d'
    for (const [x, y] of [
      [20, 14],
      [236, 14],
      [20, 146],
      [236, 146]
    ] as const)
      dot(x, y, 5)
  }
  return c
}

export interface RoomLights {
  readonly hemi: THREE.HemisphereLight
  readonly sun: THREE.DirectionalLight
}

/** Construit la chambre ; ajuste les deux lumières de la scène selon l'ambiance. */
export function buildRoom(room: AgentRoom, theme: UniverseKey, seed: number, lights: RoomLights): BuiltRoom {
  const st = STYLES[theme]
  const g = new THREE.Group()
  const animated: ((t: number) => void)[] = []
  const rT = (slot: RoomSlot): string => room.traits[slot].name

  // Sol (texture tirée), socle, murs (papier peint tiré). Pas de cadre autour du cube (choix du 2026-10-16).
  const fm = new THREE.MeshLambertMaterial({ map: texOf(floorCanvas(rT('sol'), st), 3) })
  const side = mat(st.floor)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(C, 1.5, C), [side, side, fm, side, side, side])
  floor.position.y = -0.75
  floor.receiveShadow = true
  g.add(floor)
  boxM(C + 2, 3, C + 2, 0x2a2540, 0, -3, 0, g)
  const wm = new THREE.MeshLambertMaterial({ map: texOf(paperCanvas(rT('papier'), st, seed + 9)) })
  const back = new THREE.Mesh(new THREE.BoxGeometry(C, C, 0.8), wm)
  back.position.set(0, C / 2, -HALF - 0.4)
  back.receiveShadow = true
  g.add(back)
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.8, C, C), wm)
  left.position.set(-HALF - 0.4, C / 2, 0)
  left.receiveShadow = true
  g.add(left)
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.3, 32), mat(st.rug))
  rug.position.set(1, 0.15, 2)
  rug.receiveShadow = true
  g.add(rug)

  // ---- Bureau (fond gauche) ; l'écran principal reste au même endroit.
  const bureau = rT('bureau')
  const desk = new THREE.Group()
  desk.position.set(-8, 0, -12)
  g.add(desk)
  const deskWood =
    bureau === 'Bureau gamer'
      ? 0x1f2430
      : bureau === 'Bureau de ministre'
        ? 0x5a3418
        : bureau === 'Console de vaisseau'
          ? 0xdfe6f2
          : st.wood
  if (bureau === 'Console de vaisseau') {
    const arc = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 7.5, 1, 24, 1, false, Math.PI * 0.75, Math.PI * 0.5),
      mat(deskWood)
    )
    arc.position.set(0, 6, 4.5)
    arc.castShadow = true
    desk.add(arc)
    boxM(1.5, 6, 1.5, 0x9aa3b5, 0, 3, 0, desk)
    const holo = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2.4),
      new THREE.MeshBasicMaterial({ color: 0x6ff3ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    )
    holo.position.set(4.5, 10.5, -0.5)
    desk.add(holo)
    animated.push((t) => {
      holo.material.opacity = 0.3 + Math.sin(t / 300) * 0.15
    })
  } else {
    const w = bureau === 'Bureau de ministre' ? 15 : 13
    boxM(w, 0.8, 6, deskWood, 0, 6, 0, desk)
    for (const [x, z] of [
      [-w / 2 + 1, -2.5],
      [w / 2 - 1, -2.5],
      [-w / 2 + 1, 2.5],
      [w / 2 - 1, 2.5]
    ] as const)
      boxM(0.7, 6, 0.7, deskWood, x, 3, z, desk)
  }
  // Écran(s) : visibles d'en haut (calque 1), transparents pour la webcam de la visio « posée dessus ».
  const monitor: THREE.Object3D[] = [
    boxM(7, 4.6, 0.5, 0x2a3040, 0, 9.4, -1.8, desk),
    boxM(1, 2.4, 1, 0x2a3040, 0, 7.4, -1.8, desk)
  ]
  const screen = document.createElement('canvas')
  screen.width = 128
  screen.height = 80
  const screenTexture = new THREE.CanvasTexture(screen)
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 3.9),
    new THREE.MeshBasicMaterial({ map: screenTexture })
  )
  screenMesh.position.set(0, 9.4, -1.5)
  desk.add(screenMesh)
  monitor.push(screenMesh)
  boxM(4.5, 0.3, 1.6, 0x3a4152, 0, 6.55, 0.6, desk)
  if (bureau === 'Double écran' || bureau === 'Bureau gamer') {
    const s2 = boxM(5, 3.6, 0.5, 0x2a3040, -5.2, 9, -1.4, desk)
    s2.rotation.y = 0.5
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3), new THREE.MeshBasicMaterial({ color: 0x2a6fe4 }))
    glow.position.set(-5.05, 9, -1.1)
    glow.rotation.y = 0.5
    desk.add(glow)
    monitor.push(s2, glow)
  }
  monitor.forEach((m) => m.layers.set(1))
  if (bureau === 'Bureau gamer') {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(12.6, 0.25, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2fb0 })
    )
    strip.position.set(0, 5.5, 3)
    desk.add(strip)
    animated.push((t) => strip.material.color.setHSL((t / 3000) % 1, 1, 0.55))
  }
  if (bureau === 'Bureau de ministre') {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), mat(0x3b7ff0))
    globe.position.set(5.5, 7.8, 0)
    globe.castShadow = true
    desk.add(globe)
    animated.push((t) => {
      globe.rotation.y = t / 2000
    })
  } else if (bureau !== 'Console de vaisseau') {
    boxM(0.5, 3, 0.5, st.metal, 5.2, 7.9, -1.5, desk)
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(1.3, 1.6, 16, 1, true),
      mat(st.accent, { side: THREE.DoubleSide })
    )
    shade.position.set(5.2, 9.8, -1.5)
    desk.add(shade)
  }
  const chair = new THREE.Group()
  chair.position.set(-8, 0, -6)
  g.add(chair)
  const chairC = bureau === 'Bureau gamer' ? 0xff2fb0 : bureau === 'Bureau de ministre' ? 0x2f6b2a : st.accent
  boxM(4.2, 0.6, 4.2, chairC, 0, 3.6, 0, chair)
  boxM(4.2, bureau === 'Bureau gamer' ? 6.5 : 4.5, 0.6, chairC, 0, bureau === 'Bureau gamer' ? 7 : 6, 1.9, chair)
  boxM(0.6, 3.3, 0.6, st.metal, 0, 1.7, 0, chair)

  // ---- Lit (fond droit) ; la hauteur où l'agent s'allonge dépend du lit.
  const lit = rT('lit')
  const bed = new THREE.Group()
  bed.position.set(10, 0, -9)
  g.add(bed)
  let lieY = 5
  const posts = [
    [-4.6, -7],
    [4.6, -7],
    [-4.6, 7],
    [4.6, 7]
  ] as const
  const simpleBed = (y0: number): void => {
    boxM(10, 2.6, 15, st.wood, 0, y0 + 1.3, 0, bed)
    boxM(9.4, 1.4, 14.2, 0xffffff, 0, y0 + 3.3, 0, bed)
    boxM(9.6, 1.5, 8.5, st.blanket, 0, y0 + 3.6, 3, bed)
    boxM(6, 1.4, 3, st.bed, 0, y0 + 4.4, -5, bed)
  }
  if (lit === 'Lit simple' || lit === 'Lit à baldaquin') {
    simpleBed(0)
    boxM(10, 6, 0.8, st.wood, 0, 3, -7.4, bed)
  }
  if (lit === 'Lit à baldaquin') {
    for (const [x, z] of posts) boxM(0.7, 15, 0.7, st.wood, x, 7.5, z, bed)
    const top = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.5, 15), mat(st.bed))
    top.position.y = 15
    bed.add(top)
    for (const x of [-4.8, 4.8]) {
      const cur = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 10),
        new THREE.MeshLambertMaterial({ color: st.blanket, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      )
      cur.rotation.y = Math.PI / 2
      cur.position.set(x, 10, 0)
      bed.add(cur)
    }
  }
  if (lit === 'Lit superposé') {
    simpleBed(0)
    simpleBed(7.5)
    for (const [x, z] of posts) boxM(0.7, 14, 0.7, st.wood, x, 7, z, bed)
    for (let k = 0; k < 5; k++) boxM(2.4, 0.4, 0.4, st.metal, 4.9, 2 + k * 2.4, 6.5, bed)
    lieY = 12.5
  }
  if (lit === 'Hamac') {
    for (const z of [-7, 7]) boxM(0.8, 10, 0.8, st.wood, 0, 5, z, bed)
    const ham = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 14, 20, 1, true, -Math.PI * 0.4, Math.PI * 0.8),
      mat(st.blanket, { side: THREE.DoubleSide })
    )
    ham.rotation.x = Math.PI / 2
    ham.position.y = 10.5
    ham.castShadow = true
    bed.add(ham)
    lieY = 6.5
  }
  if (lit === 'Lit-nuage') {
    const cloud = new THREE.Group()
    for (let k = 0; k < 9; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(3 + (k % 3), 16, 12), mat(0xffffff))
      puff.position.set(((k % 3) - 1) * 3, 0, (Math.floor(k / 3) - 1) * 4.5)
      puff.castShadow = true
      cloud.add(puff)
    }
    cloud.position.y = 6
    bed.add(cloud)
    animated.push((t) => {
      cloud.position.y = 6 + Math.sin(t / 900) * 0.6
    })
    lieY = 9.5
  }

  // ---- Coin sport (devant droit).
  const sport = rT('sport')
  const sp = new THREE.Group()
  sp.position.set(11, 0, 10)
  g.add(sp)
  let jump = 2.2
  if (sport === 'Haltères') {
    boxM(9, 0.35, 7, st.accent, 0, 0.2, 0, sp)
    const dumb = new THREE.Group()
    for (const x of [-1.6, 1.6]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 14), mat(0x2a3040))
      w.rotation.z = Math.PI / 2
      w.position.x = x
      w.castShadow = true
      dumb.add(w)
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.6, 8), mat(st.metal))
    bar.rotation.z = Math.PI / 2
    dumb.add(bar)
    dumb.position.set(-2.5, 0.9, -1.5)
    sp.add(dumb)
  }
  if (sport === 'Tapis de course') {
    boxM(5, 1, 10, 0x2a3040, 0, 0.5, 0, sp)
    boxM(4, 0.2, 9, 0x5b6478, 0, 1.1, 0, sp)
    for (const x of [-2.2, 2.2]) boxM(0.4, 6, 0.4, st.metal, x, 3.5, -4.5, sp)
    boxM(5, 1.2, 1, st.accent, 0, 6.5, -4.5, sp)
  }
  if (sport === 'Punching-ball') {
    boxM(0.4, 7, 0.4, st.metal, 0, 3.5, 0, sp)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), mat(0xe5484d))
    ball.position.y = 7.5
    ball.castShadow = true
    sp.add(ball)
    boxM(3, 0.5, 3, 0x2a3040, 0, 0.25, 0, sp)
    animated.push((t) => {
      ball.position.x = Math.sin(t / 250) * (built.sporting ? 0.8 : 0.1)
    })
  }
  if (sport === 'Mini-piscine') {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 4.5, 1.8, 28, 1, true),
      mat(0x8cc8ff, { side: THREE.DoubleSide })
    )
    rim.position.y = 0.9
    sp.add(rim)
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(4.4, 28),
      new THREE.MeshLambertMaterial({ color: 0x4fb6ff, transparent: true, opacity: 0.8 })
    )
    water.rotation.x = -Math.PI / 2
    water.position.y = 1.5
    sp.add(water)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.4, 10, 18), mat(0xff7ab5))
    ring.rotation.x = Math.PI / 2
    ring.position.set(1.5, 1.7, 1)
    sp.add(ring)
    animated.push((t) => {
      ring.position.y = 1.7 + Math.sin(t / 500) * 0.15
    })
  }
  if (sport === 'Trampoline') {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.4, 28), mat(0x2a3040))
    pad.position.y = 2
    sp.add(pad)
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 8, 28), mat(st.accent))
    rimT.rotation.x = Math.PI / 2
    rimT.position.y = 2.1
    sp.add(rimT)
    for (let k = 0; k < 4; k++) boxM(0.4, 2, 0.4, st.metal, Math.cos(k * 1.57) * 3.6, 1, Math.sin(k * 1.57) * 3.6, sp)
    jump = 5
  }

  // ---- Déco (devant gauche).
  const deco = rT('deco')
  const dc = new THREE.Group()
  dc.position.set(-13, 0, 13)
  g.add(dc)
  if (deco === 'Plante') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 2.6, 16), mat(0xc8663b))
    pot.position.y = 1.3
    pot.castShadow = true
    dc.add(pot)
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), mat(0x5fd068))
      leaf.position.set(Math.cos(k) * 1.2, 3.6 + (k % 3) * 0.9, Math.sin(k) * 1.2)
      leaf.castShadow = true
      dc.add(leaf)
    }
  }
  if (deco === 'Bibliothèque') {
    boxM(6, 10, 2.4, st.wood, 0, 5, -1, dc)
    const cols = [0xe5484d, 0x3b7ff0, 0xf2c14e, 0x5fd068, 0x9b6bff]
    for (let s2 = 0; s2 < 3; s2++)
      for (let k = 0; k < 5; k++)
        boxM(0.9, 2.2 - (k % 2) * 0.4, 1.8, cols[(k + s2) % 5] ?? 0xe5484d, -2.2 + k * 1.1, 1.8 + s2 * 3.2, -0.6, dc)
  }
  if (deco === 'Aquarium') {
    boxM(4, 3, 3, st.wood, 0, 1.5, 0, dc)
    const tank = new THREE.Mesh(
      new THREE.BoxGeometry(5, 3.5, 3.2),
      new THREE.MeshLambertMaterial({ color: 0x6fc6ff, transparent: true, opacity: 0.45 })
    )
    tank.position.y = 4.8
    dc.add(tank)
    const fish = [0xff8c1a, 0xffd23f, 0xff5fa2].map((color) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color }))
      f.scale.set(1.6, 1, 1)
      dc.add(f)
      return f
    })
    animated.push((t) =>
      fish.forEach((f, k) => {
        f.position.set(Math.sin(t / (900 + k * 200) + k) * 1.8, 4.2 + k * 0.6, Math.cos(t / (1100 + k * 150)) * 0.8)
      })
    )
  }
  if (deco === 'Borne d’arcade') {
    boxM(3.5, 8, 3, 0x5b2a8c, 0, 4, 0, dc)
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2), new THREE.MeshBasicMaterial({ color: 0x3ee8a8 }))
    sc.position.set(0, 6, 1.52)
    dc.add(sc)
    boxM(3.5, 0.6, 1.4, 0x2a3040, 0, 4.2, 1.8, dc)
    animated.push((t) => sc.material.color.setHSL((Math.floor(t / 400) % 6) / 6, 0.8, 0.55))
  }
  if (deco === 'Statue de neurone dorée') {
    boxM(3, 2, 3, 0xdfe6f2, 0, 1, 0, dc)
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffd24a,
      metalness: 0.8,
      roughness: 0.25,
      emissive: 0x7a5208,
      emissiveIntensity: 0.3
    })
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 14), gold)
    s2.position.y = 3.7
    s2.castShadow = true
    dc.add(s2)
    for (let k = 0; k < 3; k++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 6), gold)
      d.position.set((k - 1) * 0.8, 5.6, 0)
      d.rotation.z = (k - 1) * 0.4
      dc.add(d)
    }
    animated.push((t) => {
      s2.rotation.y = t / 1500
    })
  }

  // ---- Plan au mur (mur gauche) : le support et le schéma dessiné dessus.
  const support = rT('support')
  const SUP = SUPPORTS[support] ?? (SUPPORTS['Tableau blanc'] as BoardSupport)
  const bt = new THREE.CanvasTexture(boardCanvas(support, rT('schema'), SUP))
  const face =
    SUP.glow === true
      ? new THREE.MeshBasicMaterial({
          map: bt,
          transparent: SUP.holo === true,
          opacity: SUP.holo === true ? 0.85 : 1,
          depthWrite: SUP.holo !== true
        })
      : new THREE.MeshLambertMaterial({ map: bt })
  const board = new THREE.Group()
  board.position.set(-HALF + 0.6, 0, 6)
  g.add(board)
  if (SUP.holo === true) {
    // Hologramme : un plan lumineux qui flotte et vacille au-dessus d'un petit projecteur posé au sol.
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(11, 7), face)
    pl.rotation.y = Math.PI / 2
    pl.position.set(1.4, 10, 0)
    board.add(pl)
    boxM(1.6, 1, 1.6, 0x2a3040, 1.4, 0.5, 0, board)
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 5.6, 4, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8ef4ff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    )
    beam.position.set(1.4, 3.6, 0)
    beam.rotation.y = Math.PI / 4
    board.add(beam)
    animated.push((t) => {
      face.opacity = 0.7 + 0.15 * Math.sin(t / 130) * Math.sin(t / 47)
      pl.position.y = 10 + Math.sin(t / 700) * 0.25
    })
  } else {
    const fm2 = mat(SUP.frame ?? 0x9aa3b5)
    const bm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 11), [face, fm2, fm2, fm2, fm2, fm2])
    bm.position.set(0, 10, 0)
    board.add(bm)
    if (support === 'Parchemin') {
      boxM(0.8, 0.8, 12, 0x8a5a2b, 0.3, 13.6, 0, board)
      boxM(0.8, 0.8, 12, 0x8a5a2b, 0.3, 6.4, 0, board)
    }
    if (support === 'Tableau noir') boxM(0.9, 0.3, 11, 0x7a5530, 0.5, 6.4, 0, board)
    if (support === 'Écran mural')
      animated.push((t) => {
        face.color.setScalar(0.85 + 0.15 * Math.sin(t / 900))
      })
  }

  // ---- Ambiance : couleur des lumières, néons, bougies, aurore.
  const amb = rT('ambiance')
  const { hemi, sun } = lights
  hemi.intensity = 0.62
  sun.intensity = 0.75
  hemi.color.set(0xffffff)
  sun.color.set(0xffffff)
  if (amb === 'Soir doré') {
    hemi.color.set(0xffd2a0)
    sun.color.set(0xffb070)
    sun.intensity = 0.65
  }
  if (amb === 'Néon') {
    hemi.intensity = 0.35
    sun.intensity = 0.35
    for (const [c, x, z] of [
      [0xff2fb0, -12, -12],
      [0x2fe6ff, 12, 8]
    ] as const) {
      const l = new THREE.PointLight(c, 1.2, 40)
      l.position.set(x, 14, z)
      g.add(l)
      const tube = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: c }))
      tube.position.set(x * 0.6, 22, -HALF + 0.2)
      g.add(tube)
    }
  }
  if (amb === 'Bougies') {
    hemi.intensity = 0.38
    sun.intensity = 0.35
    const candles = (
      [
        [-3, -6],
        [5, 4],
        [-6, 8]
      ] as const
    ).map(([x, z]) => {
      boxM(0.6, 1.4, 0.6, 0xfff6e0, x, 0.7, z, g)
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb347 }))
      fl.position.set(x, 1.7, z)
      g.add(fl)
      const l = new THREE.PointLight(0xffa04a, 0.9, 16)
      l.position.set(x, 2.5, z)
      g.add(l)
      return l
    })
    animated.push((t) =>
      candles.forEach((l, k) => {
        l.intensity = 0.75 + Math.sin(t / 90 + k * 2) * 0.15
      })
    )
  }
  if (amb === 'Aurore')
    animated.push((t) => {
      hemi.color.setHSL((t / 12000) % 1, 0.6, 0.75)
    })

  const built: BuiltRoom = { group: g, screen, screenTexture, lieY, jump, animated, sporting: false }
  return built
}
