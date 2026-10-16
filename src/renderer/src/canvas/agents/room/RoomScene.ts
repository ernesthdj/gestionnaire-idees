import * as THREE from 'three'
import type { AgentCharacter, AgentRoom } from '../character/mint'
import { drawLayer, GRID, LAYERS, type LayerSlot } from '../character/portrait'
import { buildRoom, C, drawScreen, HALF, type BuiltRoom } from './roomBuild'

/**
 * Scène d'une chambre-cube (T008, L1o D13) : la pièce, la créature voxel qui y vit et ce qu'elle fait. La vue d'en haut
 * est figée (angle choisi le 2026-10-16) ; en visio, une webcam posée sur l'écran du bureau la filme de face et la
 * chambre passe en incrustation. Rendue par le renderer partagé (`roomStage`), jamais par le sien.
 */

/** Ce que fait l'agent ; `libre` enchaîne seul les autres. */
export type RoomActivity = 'libre' | 'travail' | 'pense' | 'repos' | 'fini' | 'erreur'
type Spot = Exclude<RoomActivity, 'libre'>

/** Où l'agent se tient pour chaque activité (repère de la pièce) et vers où il regarde. */
const SPOTS: Readonly<Record<Spot, { readonly x: number; readonly z: number; readonly face: number }>> = {
  travail: { x: -8, z: -6, face: Math.PI },
  erreur: { x: -8, z: -5, face: Math.PI },
  pense: { x: -12, z: 6, face: -Math.PI / 2 },
  repos: { x: 10, z: -9, face: 0 },
  fini: { x: 10, z: 10, face: Math.PI / 4 }
}
const LIBRE_CYCLE: readonly Spot[] = ['travail', 'pense', 'travail', 'fini', 'repos']
const SYMBOLS: Readonly<Partial<Record<Spot, readonly [string, string]>>> = {
  repos: ['Z', '#cfc4ff'],
  pense: ['?', '#ffd23f'],
  erreur: ['!', '#ff5c5c'],
  fini: ['♪', '#7ed957']
}
/** Profondeur de chaque calque extrudé (en voxels, vers l'avant). */
const DEPTH: Readonly<Record<LayerSlot, readonly number[]>> = {
  base: [-1, 0, 1],
  yeux: [2],
  coiffe: [-1, 0, 1],
  objet: [1, 2]
}
/** Taille de la créature dans la pièce (unités) et son échelle d'affichage. */
const CREATURE_HEIGHT = 10
const ACTOR_SCALE = 1.35

function frameOf(camera: THREE.OrthographicCamera): { cx: number; cy: number; hw: number; hh: number } {
  camera.updateMatrixWorld()
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
  for (const x of [-HALF - 1.5, HALF + 1.5])
    for (const y of [-4.5, C + 1])
      for (const z of [-HALF - 1.5, HALF + 1.5]) {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)
        b.x0 = Math.min(b.x0, v.x)
        b.x1 = Math.max(b.x1, v.x)
        b.y0 = Math.min(b.y0, v.y)
        b.y1 = Math.max(b.y1, v.y)
      }
  return {
    cx: (b.x0 + b.x1) / 2,
    cy: (b.y0 + b.y1) / 2,
    hw: ((b.x1 - b.x0) / 2) * 1.07,
    hh: ((b.y1 - b.y0) / 2) * 1.07
  }
}

function textSprite(text: string, color: string, size: number): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const x = c.getContext('2d')
  if (x !== null) {
    x.font = 'bold 96px sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.lineWidth = 10
    x.strokeStyle = '#2b2540'
    x.strokeText(text, 64, 70)
    x.fillStyle = color
    x.fillText(text, 64, 70)
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })
  )
  s.scale.set(size, size, size)
  return s
}

function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const x = c.getContext('2d')
  if (x !== null) {
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62)
    g.addColorStop(0, 'rgba(30,20,60,0.55)')
    g.addColorStop(1, 'rgba(30,20,60,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
  }
  return new THREE.CanvasTexture(c)
}

/** Créature voxel : chaque calque 32 × 32 extrudé en cubes, à sa profondeur. */
function buildCreature(
  character: AgentCharacter,
  voxel: THREE.BoxGeometry
): { body: THREE.Group; eyes: THREE.Object3D | null } {
  const body = new THREE.Group()
  const fig = new THREE.Group()
  let eyes: THREE.Object3D | null = null
  for (const slot of LAYERS) {
    const c = document.createElement('canvas')
    c.width = GRID
    c.height = GRID
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (ctx === null) continue
    drawLayer(ctx, character, slot)
    const data = ctx.getImageData(0, 0, GRID, GRID).data
    const px: [number, number, number, number, number][] = []
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        const k = (y * GRID + x) * 4
        if ((data[k + 3] ?? 0) > 60) px.push([x, y, data[k] ?? 0, data[k + 1] ?? 0, data[k + 2] ?? 0])
      }
    if (px.length === 0) continue
    const depth = DEPTH[slot]
    const mesh = new THREE.InstancedMesh(
      voxel,
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      px.length * depth.length
    )
    const m = new THREE.Matrix4()
    const col = new THREE.Color()
    let n = 0
    for (const [x, y, r, g, b] of px)
      for (const z of depth) {
        m.makeTranslation(x - GRID / 2 + 0.5, GRID - y - 0.5, z)
        mesh.setMatrixAt(n, m)
        col.setRGB(r / 255, g / 255, b / 255)
        mesh.setColorAt(n, col)
        n++
      }
    fig.add(mesh)
    if (slot === 'yeux') eyes = mesh
  }
  fig.scale.setScalar(CREATURE_HEIGHT / GRID)
  body.add(fig)
  return { body, eyes }
}

export class RoomScene {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera(-30, 30, 30, -30, 1, 400)
  private readonly view: { cx: number; cy: number; hw: number; hh: number }
  /** Webcam de la visio, posée sur l'écran du bureau, à hauteur du visage de l'agent assis. */
  private readonly webcam = new THREE.PerspectiveCamera(46, 1.12, 0.5, 300)
  private readonly screenGlow = new THREE.PointLight(0x6c9cf3, 0, 22)
  private readonly voxel = new THREE.BoxGeometry(1, 1, 1)
  private readonly blob: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private readonly room: BuiltRoom
  private readonly root = new THREE.Group()
  private readonly body: THREE.Group
  private readonly eyes: THREE.Object3D | null
  private symbol: THREE.Sprite | null = null
  private wanted: RoomActivity = 'libre'
  private activity: Spot = 'pense'
  private target = new THREE.Vector3()
  private arrived = false
  private since = 0
  private cycle = 0
  private visio = false
  private talking = false
  private lastScreen = ''
  /** Les ombres de la pièce sont calculées à la première image, puis plus jamais (rien n'y bouge). */
  shadowsReady = false

  constructor(
    character: AgentCharacter,
    room: AgentRoom,
    private readonly reduced: boolean
  ) {
    this.camera.position.set(52, 64, 52)
    this.camera.lookAt(0, 15, 0)
    this.camera.layers.enable(1)
    this.view = frameOf(this.camera)
    const hemi = new THREE.HemisphereLight(0xffffff, 0x4a3f7a, 0.62)
    const sun = new THREE.DirectionalLight(0xffffff, 0.75)
    sun.position.set(30, 70, 45)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 })
    this.scene.add(hemi, sun, this.screenGlow)
    this.room = buildRoom(room, character.universe.key, character.seed, { hemi, sun })
    this.scene.add(this.room.group)

    const creature = buildCreature(character, this.voxel)
    this.body = creature.body
    this.eyes = creature.eyes
    this.root.add(this.body)
    this.root.scale.setScalar(ACTOR_SCALE)
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
    )
    this.blob.rotation.x = -Math.PI / 2
    this.blob.position.y = 0.32
    this.root.add(this.blob)
    this.root.position.set(SPOTS.pense.x + 6, 0, SPOTS.pense.z)
    this.scene.add(this.root)
    this.goTo(LIBRE_CYCLE[0] ?? 'travail', 0)
  }

  /** L'activité voulue (l'état réel de l'agent) ; en visio, il reste à son bureau. */
  setActivity(activity: RoomActivity, t: number): void {
    if (activity === this.wanted) return
    this.wanted = activity
    this.goTo(this.effective(), t)
  }

  setVisio(on: boolean, t: number): void {
    if (on === this.visio) return
    this.visio = on
    this.screenGlow.intensity = on ? 0.9 : 0
    this.screenGlow.color.set(this.wanted === 'erreur' ? 0xff4d4d : 0x6c9cf3)
    this.goTo(this.effective(), t)
  }

  /** En visio : l'agent parle (sa tête hoche). */
  setTalking(on: boolean): void {
    this.talking = on
  }

  private effective(): Spot {
    if (this.visio) return this.wanted === 'erreur' ? 'erreur' : 'travail'
    if (this.wanted === 'libre') return LIBRE_CYCLE[this.cycle] ?? 'travail'
    return this.wanted
  }

  private goTo(activity: Spot, t: number): void {
    if (activity === this.activity && this.arrived) return
    this.activity = activity
    this.arrived = false
    this.since = t
    const s = SPOTS[activity]
    this.target = new THREE.Vector3(s.x, 0, s.z)
    this.setSymbol(null)
    if (this.reduced) this.root.position.copy(this.target)
  }

  private setSymbol(spec: readonly [string, string] | null | undefined): void {
    if (this.symbol !== null) {
      this.root.remove(this.symbol)
      this.symbol.material.map?.dispose()
      this.symbol.material.dispose()
      this.symbol = null
    }
    if (spec === null || spec === undefined) return
    const sprite = textSprite(spec[0], spec[1], 3.6)
    sprite.position.set(2.5, CREATURE_HEIGHT + 2.5, 0)
    this.root.add(sprite)
    this.symbol = sprite
  }

  private blink(scale: number): void {
    if (this.eyes !== null) this.eyes.scale.y = scale
  }

  /** Une image : déplacement, geste de l'activité, meubles animés, écran du bureau. */
  update(t: number, dt: number): void {
    const k = this.reduced ? 0 : 1
    const pos = this.root.position
    const dir = new THREE.Vector3().subVectors(this.target, pos)
    dir.y = 0
    const walking = dir.length() > 0.3 && !this.arrived
    this.body.position.set(0, 0, 0)
    this.body.rotation.set(0, 0, 0)
    this.blink(1)
    if (walking) {
      pos.addScaledVector(dir.normalize(), Math.min(dir.length(), 9 * dt))
      this.root.rotation.y = Math.atan2(dir.x, dir.z)
      this.body.position.y = Math.abs(Math.sin(t / 110)) * 0.7 * k
      this.body.rotation.z = Math.sin(t / 110) * 0.08 * k
    } else {
      if (!this.arrived) {
        this.arrived = true
        this.since = t
        this.root.rotation.y = SPOTS[this.activity].face
        this.setSymbol(SYMBOLS[this.activity])
      }
      this.perform(t, k)
    }
    const lying = this.arrived && this.activity === 'repos'
    this.blob.visible = !lying
    const h = Math.max(0, this.body.position.y)
    this.blob.scale.setScalar(Math.max(0.45, 1 - h / 9))
    this.blob.material.opacity = Math.max(0.35, 1 - h / 7)
    if (this.activity !== 'repos' && this.activity !== 'fini' && k > 0 && Math.floor(t / 160) % 26 === 0)
      this.blink(0.15)
    if (this.symbol !== null && k > 0) this.symbol.position.y = CREATURE_HEIGHT + 2.5 + Math.sin(t / 400) * 0.4
    // Vie libre : activité suivante après un moment.
    if (this.wanted === 'libre' && !this.visio && this.arrived && t - this.since > 7000) {
      this.cycle = (this.cycle + 1) % LIBRE_CYCLE.length
      this.goTo(this.effective(), t)
    }
    this.room.sporting = this.arrived && this.activity === 'fini'
    if (k > 0) for (const fn of this.room.animated) fn(t)
    if (this.visio && k > 0) this.screenGlow.intensity = 0.8 + Math.sin(t / 130) * 0.12
    const mode = this.arrived && (this.activity === 'travail' || this.activity === 'erreur') ? this.activity : 'veille'
    const key = mode === 'travail' && k > 0 ? `${mode}:${Math.floor(t / 180)}` : mode
    if (key !== this.lastScreen) {
      drawScreen(this.room.screen, mode, t)
      this.room.screenTexture.needsUpdate = true
      this.lastScreen = key
    }
  }

  private perform(t: number, k: number): void {
    const body = this.body
    switch (this.activity) {
      case 'travail':
        body.position.set(0, 1.2, -0.5)
        body.rotation.x = Math.sin(t / 900) * 0.05 * k + (this.talking ? Math.sin(t / 90) * 0.06 * k : 0)
        break
      case 'repos':
        body.rotation.x = -Math.PI / 2
        body.position.set(0, this.room.lieY / ACTOR_SCALE, -1)
        this.blink(0.12)
        if (this.symbol !== null && k > 0) this.symbol.material.opacity = 0.5 + Math.sin(t / 500) * 0.5
        break
      case 'pense':
        body.rotation.z = Math.sin(t / 700) * 0.12 * k
        break
      case 'fini':
        body.position.y = Math.abs(Math.sin(t / 200)) * this.room.jump * k + (this.room.jump > 3 ? 1.5 : 0)
        this.blink(0.55)
        break
      case 'erreur':
        body.position.x = Math.sin(t / 50) * 0.35 * k
        break
    }
  }

  private frame(camera: THREE.OrthographicCamera, aspect: number): void {
    // Un peu d'air au-dessus des murs : la chambre est posée légèrement plus bas que le centre du cadre.
    const s = Math.max(this.view.hh, this.view.hw / aspect) * 1.04
    camera.left = this.view.cx - s * aspect
    camera.right = this.view.cx + s * aspect
    camera.top = this.view.cy + s * 1.08
    camera.bottom = this.view.cy - s * 0.92
    camera.updateProjectionMatrix()
  }

  /** Dessine la scène dans le renderer partagé, sur `w × h` pixels CSS ; en visio, la chambre en incrustation. */
  render(renderer: THREE.WebGLRenderer, w: number, h: number): void {
    renderer.shadowMap.needsUpdate = !this.shadowsReady
    this.shadowsReady = true
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, w, h)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    if (!this.visio) {
      this.frame(this.camera, w / h)
      renderer.render(this.scene, this.camera)
      return
    }
    const face = CREATURE_HEIGHT * ACTOR_SCALE * 0.75
    this.webcam.aspect = w / h
    this.webcam.position.set(-8, face + 1.2, -17.3)
    this.webcam.lookAt(-8, face - 1.2, -6)
    this.webcam.updateProjectionMatrix()
    renderer.render(this.scene, this.webcam)
    const pw = Math.round(w * 0.3)
    const ph = Math.round(h * 0.3)
    const px = Math.round(w - pw - w * 0.03)
    const py = Math.round(h * 0.17)
    renderer.setScissorTest(true)
    renderer.setScissor(px - 2, py - 2, pw + 4, ph + 4)
    renderer.setViewport(px - 2, py - 2, pw + 4, ph + 4)
    renderer.setClearColor(0xffffff, 0.9)
    renderer.clear()
    renderer.setClearColor(0x000000, 0)
    renderer.setScissor(px, py, pw, ph)
    renderer.setViewport(px, py, pw, ph)
    renderer.clear()
    this.frame(this.camera, pw / ph)
    renderer.render(this.scene, this.camera)
    renderer.setScissorTest(false)
  }

  dispose(): void {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.InstancedMesh) {
        if (o.geometry !== this.voxel) o.geometry.dispose()
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose()
          m.dispose()
        }
      }
    })
    this.voxel.dispose()
  }
}
