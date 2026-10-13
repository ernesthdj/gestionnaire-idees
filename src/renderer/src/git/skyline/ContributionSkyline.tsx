import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  barHeight,
  buildGrid,
  camera,
  computeStats,
  countByDay,
  dayOf,
  easeInOutCubic,
  ELEV_3D,
  ELEV_RANGE,
  keyMs,
  lerp,
  monthLabels,
  project,
  riseAt,
  smoothstep,
  YAW_3D,
  YAW_RANGE,
  type Camera,
  type Grid
} from './contributions'

type View = '2d' | '3d'
type RGB = readonly [number, number, number]

/** Part de la couleur de base à chaque niveau (1 à 4), mêlée à la couleur des jours vides. */
const LEVEL_MIX = [0.35, 0.55, 0.78, 1] as const
const LEVEL_NAMES = ['Aucun commit', 'Peu', 'Modéré', 'Soutenu', 'Intense'] as const

let probe: CanvasRenderingContext2D | null = null
/** Toute couleur CSS → sRGB, en la laissant peindre par le navigateur (gère var(), color-mix, noms…). */
function toRGB(color: string, fallback: RGB): RGB {
  if (probe === null) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    probe = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (probe === null) return fallback
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = 'rgba(0,0,0,0)'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const data = probe.getImageData(0, 0, 1, 1).data
  return (data[3] ?? 0) < 8 ? fallback : [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0]
}
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
]
const luminance = (c: RGB): number => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
const rgb = (r: number, g: number, b: number): string => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`

function pointInQuad(points: Float32Array, offset: number, x: number, y: number): boolean {
  let sign = 0
  for (let k = 0; k < 4; k += 1) {
    const ax = points[offset + k * 2] ?? 0
    const ay = points[offset + k * 2 + 1] ?? 0
    const bx = points[offset + ((k + 1) % 4) * 2] ?? 0
    const by = points[offset + ((k + 1) % 4) * 2 + 1] ?? 0
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
    if (Math.abs(cross) < 1e-9) continue
    const side = cross > 0 ? 1 : -1
    if (sign === 0) sign = side
    else if (side !== sign) return false
  }
  return sign !== 0
}

function quadPath(ctx: CanvasRenderingContext2D, p: Float32Array, o: number, radius: number): void {
  const at = (index: number): number => p[o + index] ?? 0
  if (radius < 0.3) {
    ctx.moveTo(at(0), at(1))
    ctx.lineTo(at(2), at(3))
    ctx.lineTo(at(4), at(5))
    ctx.lineTo(at(6), at(7))
    ctx.closePath()
    return
  }
  ctx.moveTo((at(6) + at(0)) / 2, (at(7) + at(1)) / 2)
  for (let k = 0; k < 4; k += 1) {
    const next = (k + 1) % 4
    ctx.arcTo(at(k * 2), at(k * 2 + 1), at(next * 2), at(next * 2 + 1), radius)
  }
  ctx.closePath()
}

const numbers = new Intl.NumberFormat('fr-BE')
const shortDate = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
})
const commits = (count: number): string =>
  count === 0 ? 'aucun commit' : `${numbers.format(count)} commit${count > 1 ? 's' : ''}`
const describe = (date: string, count: number): string => `${commits(count)} le ${longDate.format(keyMs(date))}`
const range = (start: string | null, end: string | null): string =>
  start === null || end === null ? '—' : `${shortDate.format(keyMs(start))} — ${shortDate.format(keyMs(end))}`

interface Engine {
  readonly kick: () => void
  readonly load: () => void
  readonly retheme: () => void
  readonly tipWidth: (width: number) => void
}

/**
 * Skyline des contributions (spec 021 D16) : les commits par jour sur un an, en carte de chaleur (2D) qui se replie en
 * relief isométrique (3D). Survol ou flèches du clavier : le nombre du jour ; Entrée ou clic : `onDayClick` ; en 3D,
 * glisser = orbite, double-clic = vue d'origine ; survol de la légende = isole un niveau. Couleur : celle de l'auteur
 * choisi, sinon l'accent du thème ; suit le thème (clair, sombre, carbone) et `prefers-reduced-motion`.
 * Principe repris du composant « Contribution Skyline » de 21st.dev (kedhareswer) ; code réécrit pour l'app.
 */
export function ContributionSkyline({
  dates,
  color,
  title,
  onDayClick
}: {
  /** Dates ISO des commits affichés. */
  readonly dates: readonly string[]
  /** Couleur de base (celle d'un auteur) ; `null` : l'accent du thème. */
  readonly color: string | null
  readonly title: string
  readonly onDayClick?: (date: string) => void
}): React.JSX.Element {
  const model = useMemo(() => {
    const days = dates.map(dayOf).filter(Number.isFinite)
    const end = days.length === 0 ? dayOf(new Date().toISOString()) : Math.max(...days)
    const grid = buildGrid(countByDay(dates), end)
    return { ...grid, stats: computeStats(grid.cells), months: monthLabels(grid.cells, grid.weeks) }
  }, [dates])
  const [view, setView] = useState<View>('3d')
  const [active, setActive] = useState(-1)
  const [legendLevel, setLegendLevel] = useState(-1)
  const [swatches, setSwatches] = useState<readonly string[]>([])
  const [announce, setAnnounce] = useState('')
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  // Ce que lit la boucle de rendu, rafraîchi à chaque rendu : elle ne garde jamais de props périmées.
  const cfg = useRef({ model, color, legendLevel, target: 1, onDayClick, setActive, setSwatches, setAnnounce })
  cfg.current = {
    model,
    color,
    legendLevel,
    target: view === '3d' ? 1 : 0,
    onDayClick,
    setActive,
    setSwatches,
    setAnnounce
  }

  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    const canvas = canvasRef.current
    const tip = tipRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (root === null || stage === null || canvas === null || tip === null || ctx === null) return
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = reduceQuery.matches
    // t : 0 (2D) → 1 (3D), linéaire ; la caméra l'adoucit, les barres en font une vague.
    let t = 0
    let target = 0
    let entered = false
    let yaw = 0
    let elev = 0
    let yawGoal = 0
    let elevGoal = 0
    let width = 0
    let height2 = 0
    let height3 = 0
    let heightMax = 0
    let lastHeight = -1
    let dpr = 1
    let gutter = 30
    let font = '10px sans-serif'
    // Couleurs [vide, n1, n2, n3, n4] × rgb, qui glissent vers leur but.
    const colors = new Float32Array(15)
    const colorGoal = new Float32Array(15)
    let colorsReady = false
    let fg: RGB = [24, 24, 27]
    let bg: RGB = [255, 255, 255]
    let n = 0
    let weeks = 0
    let wk = new Float32Array(0)
    let dy = new Float32Array(0)
    let lv = new Uint8Array(0)
    let hgt = new Float32Array(0)
    let zs = new Float32Array(0)
    let hover = new Float32Array(0)
    let dim = new Float32Array(0)
    let polys = new Float32Array(0)
    let faces = new Uint8Array(0)
    let order: number[] = []
    let months: { week: number; label: string }[] = []
    let weekdayRows: { day: number; label: string }[] = []
    let hovered = -1
    let pinned = -1
    let activeIndex = -1
    let tipWidth = 0
    let frame = 0
    let last = 0

    const load = (): void => {
      const grid: Grid & { months: { week: number; label: string }[] } = cfg.current.model
      n = grid.cells.length
      weeks = grid.weeks
      if (wk.length !== n) {
        wk = new Float32Array(n)
        dy = new Float32Array(n)
        lv = new Uint8Array(n)
        hgt = new Float32Array(n)
        zs = new Float32Array(n)
        hover = new Float32Array(n)
        dim = new Float32Array(n)
        polys = new Float32Array(n * 24)
        faces = new Uint8Array(n)
        order = Array.from({ length: n }, (_, index) => index)
      }
      grid.cells.forEach((cell, index) => {
        wk[index] = cell.week
        dy[index] = cell.day
        lv[index] = cell.level
        hgt[index] = barHeight(cell.count, grid.max)
      })
      months = grid.months
      // Lundi en haut : libellés lun., mer., ven.
      weekdayRows = [
        { day: 0, label: 'lun.' },
        { day: 2, label: 'mer.' },
        { day: 4, label: 'ven.' }
      ]
      if (hovered >= n) hovered = -1
      if (pinned >= n) pinned = -1
    }

    const retheme = (): void => {
      const style = getComputedStyle(root)
      fg = toRGB(style.color, fg)
      bg = toRGB(style.backgroundColor, luminance(fg) > 0.5 ? [24, 24, 27] : [255, 255, 255])
      const dark = luminance(bg) < 0.45
      font = `400 10px ${style.fontFamily || 'sans-serif'}`
      const base = toRGB(cfg.current.color ?? style.getPropertyValue('--color-accent').trim(), [37, 99, 235])
      const empty = mix(bg, fg, dark ? 0.11 : 0.075)
      const all: RGB[] = [empty, ...LEVEL_MIX.map((share) => mix(empty, base, share))]
      all.forEach((value, level) => value.forEach((channel, index) => (colorGoal[level * 3 + index] = channel)))
      if (!colorsReady || reduced) {
        colors.set(colorGoal)
        colorsReady = true
      }
      const next = all.map((value) => rgb(...value))
      cfg.current.setSwatches((previous) => (previous.join() === next.join() ? previous : next))
      kick()
    }

    // Étendue projetée de la scène pour la caméra e, chaque barre à sa hauteur (pleine ou du moment).
    const extent = (cam: Camera, e: number, full: boolean) => {
      const side = lerp(0.78, 0.9, e)
      const off = (1 - side) / 2
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      const add = (x: number, y: number, z: number): void => {
        const [px, py] = project(cam, x, y, z)
        minX = Math.min(minX, px)
        maxX = Math.max(maxX, px)
        minY = Math.min(minY, py)
        maxY = Math.max(maxY, py)
      }
      for (let index = 0; index < n; index += 1) {
        const x0 = (wk[index] ?? 0) + off
        const y0 = (dy[index] ?? 0) + off
        const z = full ? (hgt[index] ?? 0) * e : (zs[index] ?? 0)
        add(x0, y0, z)
        add(x0 + side, y0, z)
        add(x0, y0 + side, z)
        add(x0 + side, y0 + side, 0)
        add(x0, y0 + side, 0)
        add(x0 + side, y0, 0)
      }
      // Place des mois qui longent le bord avant en 3D.
      add(0, 7 + 1.5 * e, 0)
      add(weeks, 7 + 1.5 * e, 0)
      return { minX, maxX, minY, maxY }
    }

    const relayout = (): void => {
      const next = Math.round(stage.clientWidth)
      if (next === 0 || n === 0) return
      width = next
      gutter = width < 520 ? 0 : 30
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const flat = extent(camera(0), 0, true)
      height2 = 24 + ((flat.maxY - flat.minY) / (flat.maxX - flat.minX)) * (width - gutter - 4)
      const relief = extent(camera(1), 1, true)
      const natural = ((relief.maxY - relief.minY) / (relief.maxX - relief.minX)) * (width - 40) + 40
      height3 = Math.max(Math.min(natural, width * 0.6, 420), Math.min(natural, 200))
      heightMax = Math.ceil(Math.max(height2, height3))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(heightMax * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${heightMax}px`
      lastHeight = -1
      draw()
    }

    const draw = (): void => {
      if (width === 0 || n === 0) return
      const e = easeInOutCubic(t)
      const cam = camera(e, yaw, elev)
      const stageHeight = lerp(height2, height3, e)
      if (Math.abs(stageHeight - lastHeight) > 0.2) {
        stage.style.height = `${stageHeight.toFixed(1)}px`
        lastHeight = stageHeight
      }
      for (let index = 0; index < n; index += 1) {
        zs[index] = riseAt(t, wk[index] ?? 0, weeks, dy[index] ?? 0) * (hgt[index] ?? 0)
      }
      const bounds = extent(cam, e, false)
      const pad = lerp(2, 20, e)
      const left = pad + gutter * (1 - e)
      const top = pad + 20 * (1 - e)
      const areaW = width - left - pad
      const areaH = stageHeight - top - pad
      const boundsW = Math.max(1e-6, bounds.maxX - bounds.minX)
      const boundsH = Math.max(1e-6, bounds.maxY - bounds.minY)
      const scale = Math.min(areaW / boundsW, areaH / boundsH)
      const ox = left + (areaW - boundsW * scale) / 2 - bounds.minX * scale
      const oy = top + (areaH - boundsH * scale) / 2 - bounds.minY * scale
      const { cs, sn, se, ce } = cam
      const px = (x: number, y: number): number => ox + (x * cs - y * sn) * scale
      const py = (x: number, y: number, z: number): number => oy + ((x * sn + y * cs) * se - z * ce) * scale

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, heightMax)
      // Peintre : du plus loin au plus proche.
      const depth = (index: number): number => ((wk[index] ?? 0) + 0.5) * sn + ((dy[index] ?? 0) + 0.5) * cs
      order.sort((a, b) => depth(a) - depth(b))

      const side = lerp(0.78, 0.9, e)
      const off = (1 - side) / 2
      const radius = lerp(0.17, 0.03, e) * scale
      const outline = (1 - e) * 0.07
      const lift = 0.7 * e
      for (const index of order) {
        const x0 = (wk[index] ?? 0) + off
        const y0 = (dy[index] ?? 0) + off
        const x1 = x0 + side
        const y1 = y0 + side
        const z = (zs[index] ?? 0) + (hover[index] ?? 0) * lift
        const o = index * 24
        const corners = [
          // dessus
          px(x0, y0),
          py(x0, y0, z),
          px(x1, y0),
          py(x1, y0, z),
          px(x1, y1),
          py(x1, y1, z),
          px(x0, y1),
          py(x0, y1, z),
          // face +y (à gauche à l'écran)
          px(x0, y1),
          py(x0, y1, 0),
          px(x1, y1),
          py(x1, y1, 0),
          px(x1, y1),
          py(x1, y1, z),
          px(x0, y1),
          py(x0, y1, z),
          // face +x (à droite à l'écran)
          px(x1, y0),
          py(x1, y0, 0),
          px(x1, y1),
          py(x1, y1, 0),
          px(x1, y1),
          py(x1, y1, z),
          px(x1, y0),
          py(x1, y0, z)
        ]
        polys.set(corners, o)
        const tall = z * ce * scale
        faces[index] =
          (tall > 0.35 && side * cs * scale > 0.35 ? 1 : 0) | (tall > 0.35 && side * sn * scale > 0.35 ? 2 : 0)

        const level = (lv[index] ?? 0) * 3
        let r = colors[level] ?? 0
        let g = colors[level + 1] ?? 0
        let b = colors[level + 2] ?? 0
        const dimmed = dim[index] ?? 0
        if (dimmed > 0.002) {
          r += ((colors[0] ?? 0) - r) * 0.72 * dimmed
          g += ((colors[1] ?? 0) - g) * 0.72 * dimmed
          b += ((colors[2] ?? 0) - b) * 0.72 * dimmed
        }
        const lit = hover[index] ?? 0
        if (lit > 0.002) {
          r += (fg[0] - r) * 0.16 * lit
          g += (fg[1] - g) * 0.16 * lit
          b += (fg[2] - b) * 0.16 * lit
        }
        const face = faces[index] ?? 0
        if ((face & 1) !== 0) {
          ctx.beginPath()
          quadPath(ctx, polys, o + 8, 0)
          ctx.fillStyle = rgb(r * 0.84, g * 0.84, b * 0.84)
          ctx.fill()
        }
        if ((face & 2) !== 0) {
          ctx.beginPath()
          quadPath(ctx, polys, o + 16, 0)
          ctx.fillStyle = rgb(r * 0.68, g * 0.68, b * 0.68)
          ctx.fill()
        }
        ctx.beginPath()
        quadPath(ctx, polys, o, radius)
        ctx.fillStyle = rgb(r, g, b)
        ctx.fill()
        if (outline > 0.004) {
          ctx.strokeStyle = `rgba(${fg.join(',')},${outline.toFixed(3)})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
        if (lit > 0.02) {
          ctx.strokeStyle = `rgba(${fg.join(',')},${(0.85 * lit).toFixed(3)})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      // Libellés : en haut et à gauche en 2D, le long du bord avant en 3D ; ils s'estompent, jamais ne sautent.
      const muted = mix(bg, fg, 0.55).map(Math.round).join(',')
      ctx.font = font
      const flatAlpha = 1 - smoothstep(0, 0.4, e)
      const reliefAlpha = smoothstep(0.62, 1, e)
      if (flatAlpha > 0.004) {
        ctx.fillStyle = `rgba(${muted},${flatAlpha.toFixed(3)})`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        let edge = -Infinity
        for (const month of months) {
          const x = px(month.week + off, -0.3)
          const textWidth = ctx.measureText(month.label).width
          if (x < edge || x + textWidth > width) continue
          ctx.fillText(month.label, x, py(month.week + off, -0.3, 0) - 3)
          edge = x + textWidth + 6
        }
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        if (gutter > 0) {
          for (const row of weekdayRows) ctx.fillText(row.label, px(0, row.day + 0.5) - 6, py(0, row.day + 0.5, 0))
        }
      }
      if (reliefAlpha > 0.004) {
        ctx.fillStyle = `rgba(${muted},${reliefAlpha.toFixed(3)})`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        let edge = -Infinity
        for (const month of months) {
          const x = px(month.week + 0.5, 7.3)
          const textWidth = ctx.measureText(month.label).width
          if (x < edge || x + textWidth > width) continue
          ctx.fillText(month.label, x, py(month.week + 0.5, 7.3, 0) + 2)
          edge = x + textWidth + 10
        }
      }

      // L'infobulle suit la case active pendant le repli et l'orbite.
      if (activeIndex >= 0 && activeIndex < n) {
        const index = activeIndex
        const z = (zs[index] ?? 0) + (hover[index] ?? 0) * lift
        const x0 = (wk[index] ?? 0) + off
        const y0 = (dy[index] ?? 0) + off
        const tipX = px(x0 - off + 0.5, y0 - off + 0.5)
        const tipY = Math.min(py(x0, y0, z), py(x0 + side, y0, z), py(x0, y0 + side, z))
        const half = tipWidth / 2
        const centre = Math.min(width - half - 2, Math.max(half + 2, tipX))
        tip.style.transform = `translate(${(centre - half).toFixed(1)}px,${(tipY - 8).toFixed(1)}px) translateY(-100%)`
        tip.style.setProperty('--arrow', `${(tipX - centre + half).toFixed(1)}px`)
      }
    }

    const tick = (now: number): void => {
      frame = 0
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      let moving = false
      if (t !== target) {
        const step = reduced ? 1 : (dt * 1000) / 1300
        t = target > t ? Math.min(target, t + step) : Math.max(target, t - step)
        moving = true
      }
      const orbitEase = reduced ? 1 : 1 - Math.exp(-dt * 12)
      yaw += (yawGoal - yaw) * orbitEase
      elev += (elevGoal - elev) * orbitEase
      if (Math.abs(yawGoal - yaw) > 1e-4 || Math.abs(elevGoal - elev) > 1e-4) moving = true
      else {
        yaw = yawGoal
        elev = elevGoal
      }
      const colorEase = reduced ? 1 : 1 - Math.exp(-dt * 7)
      for (let k = 0; k < 15; k += 1) {
        const gap = (colorGoal[k] ?? 0) - (colors[k] ?? 0)
        if (Math.abs(gap) > 0.4) {
          colors[k] = (colors[k] ?? 0) + gap * colorEase
          moving = true
        } else colors[k] = colorGoal[k] ?? 0
      }
      const hoverEase = reduced ? 1 : 1 - Math.exp(-dt * 16)
      const dimEase = reduced ? 1 : 1 - Math.exp(-dt * 10)
      const legend = cfg.current.legendLevel
      for (let index = 0; index < n; index += 1) {
        const hoverGoal = index === activeIndex ? 1 : 0
        const dimGoal = legend >= 0 && lv[index] !== legend ? 1 : 0
        const h = hover[index] ?? 0
        const d = dim[index] ?? 0
        if (h !== hoverGoal) {
          hover[index] = Math.abs(hoverGoal - h) < 0.003 ? hoverGoal : h + (hoverGoal - h) * hoverEase
          moving = true
        }
        if (d !== dimGoal) {
          dim[index] = Math.abs(dimGoal - d) < 0.003 ? dimGoal : d + (dimGoal - d) * dimEase
          moving = true
        }
      }
      draw()
      if (moving) frame = requestAnimationFrame(tick)
    }

    const kick = (): void => {
      if (frame !== 0) return
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }

    // Case active : celle survolée, sinon celle épinglée (clic ou clavier).
    const refreshActive = (): void => {
      const next = hovered >= 0 ? hovered : pinned
      if (next === activeIndex) return
      activeIndex = next
      cfg.current.setActive(next)
      kick()
    }

    const hit = (x: number, y: number): number => {
      for (let k = n - 1; k >= 0; k -= 1) {
        const index = order[k] ?? 0
        const o = index * 24
        const face = faces[index] ?? 0
        if (pointInQuad(polys, o, x, y)) return index
        if ((face & 1) !== 0 && pointInQuad(polys, o + 8, x, y)) return index
        if ((face & 2) !== 0 && pointInQuad(polys, o + 16, x, y)) return index
      }
      return -1
    }
    const local = (event: PointerEvent): readonly [number, number] => {
      const box = canvas.getBoundingClientRect()
      return [event.clientX - box.left, event.clientY - box.top]
    }
    const choose = (index: number): void => {
      const cell = cfg.current.model.cells[index]
      if (cell !== undefined) cfg.current.onDayClick?.(cell.date)
    }

    let drag: { id: number; x: number; y: number; yaw: number; elev: number; moved: boolean; orbit: boolean } | null =
      null
    const onDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const orbit = target === 1
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        yaw: yawGoal,
        elev: elevGoal,
        moved: false,
        orbit
      }
      if (orbit) canvas.setPointerCapture?.(event.pointerId)
    }
    const onMove = (event: PointerEvent): void => {
      if (drag !== null && drag.orbit && event.pointerId === drag.id) {
        const dx = event.clientX - drag.x
        const dyy = event.clientY - drag.y
        if (drag.moved || Math.hypot(dx, dyy) > 4) {
          drag.moved = true
          yawGoal = Math.min(YAW_RANGE[1] - YAW_3D, Math.max(YAW_RANGE[0] - YAW_3D, drag.yaw + dx * 0.006))
          elevGoal = Math.min(ELEV_RANGE[1] - ELEV_3D, Math.max(ELEV_RANGE[0] - ELEV_3D, drag.elev + dyy * 0.004))
          canvas.style.cursor = 'grabbing'
          hovered = -1
          refreshActive()
          kick()
          return
        }
      }
      if (event.pointerType !== 'mouse') return
      const [x, y] = local(event)
      const index = hit(x, y)
      if (index !== hovered) {
        hovered = index
        refreshActive()
      }
      canvas.style.cursor = target === 1 ? 'grab' : index >= 0 ? 'pointer' : 'default'
    }
    const onUp = (event: PointerEvent): void => {
      if (drag === null || event.pointerId !== drag.id) return
      const moved = drag.moved
      drag = null
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      canvas.style.cursor = target === 1 ? 'grab' : 'default'
      if (moved) return
      const [x, y] = local(event)
      const index = hit(x, y)
      pinned = index === pinned ? -1 : index
      if (event.pointerType !== 'mouse') hovered = -1
      refreshActive()
      if (index >= 0) choose(index)
    }
    const onCancel = (): void => {
      drag = null
    }
    const onLeave = (): void => {
      if (drag !== null) return
      hovered = -1
      refreshActive()
    }
    const onDouble = (): void => {
      yawGoal = 0
      elevGoal = 0
      kick()
    }
    const onKey = (event: KeyboardEvent): void => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape', 'Enter', ' ']
      if (!keys.includes(event.key) || n === 0) return
      event.preventDefault()
      if (event.key === 'Escape') {
        pinned = -1
        hovered = -1
        refreshActive()
        return
      }
      let index = pinned >= 0 ? pinned : activeIndex >= 0 ? activeIndex : n - 1
      if (event.key === 'Enter' || event.key === ' ') {
        choose(index)
        return
      }
      if (pinned >= 0 || activeIndex >= 0) {
        if (event.key === 'ArrowLeft') index -= 7
        if (event.key === 'ArrowRight') index += 7
        if (event.key === 'ArrowUp') index -= 1
        if (event.key === 'ArrowDown') index += 1
        if (event.key === 'Home') index = 0
        if (event.key === 'End') index = n - 1
      }
      index = Math.max(0, Math.min(n - 1, index))
      pinned = index
      hovered = -1
      refreshActive()
      const cell = cfg.current.model.cells[index]
      if (cell !== undefined) cfg.current.setAnnounce(describe(cell.date, cell.count))
    }
    const onBlur = (): void => {
      pinned = -1
      refreshActive()
    }
    const setTarget = (): void => {
      const goal = cfg.current.target
      if (!entered || goal === target) return
      target = goal
      if (goal === 0) {
        yawGoal = 0
        elevGoal = 0
      }
      canvas.style.cursor = target === 1 ? 'grab' : 'default'
      kick()
    }

    load()
    retheme()
    relayout()
    // Le relief monte de la vue à plat la première fois qu'il est vu.
    const enter = (): void => {
      if (entered) return
      entered = true
      if (reduced) t = cfg.current.target
      setTarget()
    }
    const seen =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                enter()
                seen?.disconnect()
              }
            },
            { threshold: 0.35 }
          )
    if (seen === null) enter()
    else seen.observe(stage)
    const resized =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (Math.round(stage.clientWidth) !== width) relayout()
          })
    resized?.observe(stage)
    // Thème : attribut `data-theme` de <html> (tokens.css) ou préférence du système.
    const themed = new MutationObserver(retheme)
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onReduce = (): void => {
      reduced = reduceQuery.matches
      kick()
    }
    reduceQuery.addEventListener('change', onReduce)
    darkQuery.addEventListener('change', retheme)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('dblclick', onDouble)
    canvas.addEventListener('keydown', onKey)
    canvas.addEventListener('blur', onBlur)
    engine.current = {
      kick: () => {
        setTarget()
        kick()
      },
      load: () => {
        load()
        retheme()
        relayout()
      },
      retheme,
      tipWidth: (value) => {
        tipWidth = value
        draw()
      }
    }
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      seen?.disconnect()
      resized?.disconnect()
      themed.disconnect()
      reduceQuery.removeEventListener('change', onReduce)
      darkQuery.removeEventListener('change', retheme)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('dblclick', onDouble)
      canvas.removeEventListener('keydown', onKey)
      canvas.removeEventListener('blur', onBlur)
      engine.current = null
    }
  }, [])

  useEffect(() => engine.current?.kick(), [view, legendLevel])
  useEffect(() => engine.current?.load(), [model])
  useEffect(() => engine.current?.retheme(), [color])
  // La largeur de l'infobulle la garde dans le cadre : mesurée quand son texte change.
  useLayoutEffect(() => {
    if (tipRef.current !== null && active >= 0) engine.current?.tipWidth(tipRef.current.offsetWidth)
  }, [active, model])

  const { stats } = model
  const is3d = view === '3d'
  const activeCell = model.cells[active]
  const plural = (count: number, word: string): string => (count > 1 ? `${word}s` : word)
  const blocks = [
    {
      label: 'Sur un an',
      value: numbers.format(stats.total),
      unit: plural(stats.total, 'commit'),
      sub: range(model.cells[0]?.date ?? null, model.cells.at(-1)?.date ?? null)
    },
    {
      label: 'Jour le plus chargé',
      value: numbers.format(stats.busiest.count),
      unit: plural(stats.busiest.count, 'commit'),
      sub: stats.busiest.date === null ? '—' : shortDate.format(keyMs(stats.busiest.date))
    },
    {
      label: 'Plus longue série',
      value: numbers.format(stats.longest.days),
      unit: plural(stats.longest.days, 'jour'),
      sub: range(stats.longest.start, stats.longest.end)
    },
    {
      label: 'Série en cours',
      value: numbers.format(stats.current.days),
      unit: plural(stats.current.days, 'jour'),
      sub: range(stats.current.start, stats.current.end)
    }
  ]

  return (
    <section
      ref={rootRef}
      aria-label="Skyline des contributions"
      className="@container relative flex flex-col gap-2 rounded-md border border-content-muted/20 bg-surface p-2 text-content"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="font-semibold">
          {title} : <span className="tabular-nums">{numbers.format(stats.total)}</span> commit
          {stats.total > 1 ? 's' : ''} sur un an
        </p>
        <div role="group" aria-label="Vue de la Skyline" className="flex gap-1">
          {(['2d', '3d'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`rounded px-2 py-1 ${view === value ? 'bg-accent/15 font-semibold' : 'hover:bg-surface-raised'}`}
            >
              {value === '2d' ? 'Carte de chaleur' : 'Relief 3D'}
            </button>
          ))}
        </div>
      </header>
      <div className="relative">
        <div
          ref={stageRef}
          className="relative w-full overflow-hidden rounded has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
          style={{ height: 150 }}
        >
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            aria-label={`${commits(stats.total)} sur un an, en ${is3d ? 'relief 3D' : 'carte de chaleur'}. Flèches du clavier pour lire chaque jour, Entrée pour le voir dans la frise.`}
            className="absolute top-0 left-0 block outline-none"
            style={{ maxWidth: 'none', touchAction: is3d ? 'pan-y' : 'auto' }}
          />
        </div>
        <div
          ref={tipRef}
          role="tooltip"
          aria-hidden={active < 0}
          className="pointer-events-none absolute top-0 left-0 z-20 rounded-md bg-content px-2 py-1 text-xs whitespace-nowrap text-surface shadow-lg transition-opacity duration-150 motion-reduce:transition-none"
          style={{ opacity: active >= 0 ? 1 : 0 }}
        >
          {activeCell === undefined ? ' ' : describe(activeCell.date, activeCell.count)}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs @lg:grid-cols-4">
        {blocks.map((block) => (
          <div key={block.label} className="min-w-0">
            <dt className="text-content-muted">{block.label}</dt>
            <dd className="flex items-baseline gap-1">
              <span className="text-lg font-semibold tabular-nums" style={{ color: swatches[4] }}>
                {block.value}
              </span>
              {block.unit}
            </dd>
            <dd className="truncate text-content-muted">{block.sub}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
        <span>
          {is3d ? 'Glisser pour tourner · double-clic pour revenir' : 'Survoler un jour · flèches du clavier'}
        </span>
        <div className="flex items-center gap-1" onMouseLeave={() => setLegendLevel(-1)}>
          <span>Moins</span>
          {swatches.map((swatch, level) => (
            <button
              key={level}
              type="button"
              aria-label={`Isoler les jours « ${LEVEL_NAMES[level] ?? ''} »`}
              aria-pressed={legendLevel === level}
              title={LEVEL_NAMES[level]}
              onMouseEnter={() => setLegendLevel(level)}
              onFocus={() => setLegendLevel(level)}
              onBlur={() => setLegendLevel(-1)}
              onClick={() => setLegendLevel((current) => (current === level ? -1 : level))}
              className="h-3 w-3 rounded-sm transition-transform hover:scale-125 motion-reduce:transition-none"
              style={{ background: swatch }}
            />
          ))}
          <span>Plus</span>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  )
}
