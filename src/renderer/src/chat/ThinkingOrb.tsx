import { useEffect, useRef } from 'react'

/**
 * Orbe de points en 3D qui s'illumine pendant que Claude travaille. Adapté du composant « AI thinking orb » de
 * 21st.dev (référence visuelle choisie par mentalyas) : même sphère de points en anneaux, même projection et mêmes
 * motifs lumineux, ramenés à une petite taille pour une bulle de chat. Couleurs lues dans les jetons du thème
 * (points : `--color-content-muted`, lumière : `--color-accent`). Animations réduites : une seule image fixe.
 */

const TAU = Math.PI * 2
const RINGS = 11
/** Inclinaison de la sphère vers l'observateur. */
const TILT = 0.35

interface Dot {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly seed: number
}

/** Sphère de points : anneaux de latitude, plus de points à l'équateur (déterministe, sans hasard). */
const DOTS: readonly Dot[] = (() => {
  const out: Dot[] = []
  for (let ring = 0; ring < RINGS; ring += 1) {
    const y = 1 - ((ring + 0.5) / RINGS) * 2
    const radius = Math.sqrt(1 - y * y)
    const count = Math.max(4, Math.round(20 * radius))
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * TAU + ring * 0.35
      out.push({
        x: Math.cos(angle) * radius,
        y,
        z: Math.sin(angle) * radius,
        seed: ((ring * 31 + index * 17) % 97) / 15
      })
    }
  }
  return out
})()

type Rgb = readonly [number, number, number]

/** Couleur d'un jeton (`#rrggbb`, `#rgb` ou `rgb(…)`), sinon la valeur de repli. */
function tokenColor(element: Element, name: string, fallback: Rgb): Rgb {
  const raw = getComputedStyle(element).getPropertyValue(name).trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw)?.[1]
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
    return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as unknown as Rgb
  }
  const rgb = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(raw)
  return rgb === null ? fallback : [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
}

export function ThinkingOrb({
  program,
  reduced,
  size = 44
}: {
  /** Motif lumineux (0 : tête qui tourne, 1 : deux taches, 2 : bande, 3 : tête rapide). */
  readonly program: 0 | 1 | 2 | 3
  readonly reduced: boolean
  readonly size?: number
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const programRef = useRef(program)
  programRef.current = program

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d') ?? null
    if (canvas === null || context === null) return
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * ratio)
    canvas.height = Math.round(size * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    const center = size / 2
    const sphere = size * 0.4
    const dotScale = size / 132
    const lit = new Float32Array(DOTS.length)
    const weights = [1, 0, 0, 0]
    let base = tokenColor(canvas, '--color-content-muted', [161, 161, 170])
    let light = tokenColor(canvas, '--color-accent', [96, 165, 250])
    let time = 1.2
    let rotation = 0
    let frame = 0
    let last = performance.now()
    let tick = 0

    const draw = (dt: number): void => {
      context.clearRect(0, 0, size, size)
      time += dt
      rotation += 0.9 * dt
      // Passage en douceur d'un motif à l'autre (≈ 0,35 s).
      const step = dt / 0.35
      for (let q = 0; q < 4; q += 1) {
        const target = q === programRef.current ? 1 : 0
        const delta = target - (weights[q] ?? 0)
        weights[q] = (weights[q] ?? 0) + (Math.abs(delta) <= step ? delta : Math.sign(delta) * step)
      }
      const decay = Math.exp(-dt / 0.5)
      const count = DOTS.length
      const head0 = (time * 120) % count
      const head3 = (time * 200) % count
      const a1 = time * 0.8
      const b1 = Math.sin(time * 0.5) * 0.9
      const a2 = time * 0.55 + 2.1
      const b2 = Math.cos(time * 0.42) * 0.9
      const f1 = [Math.cos(b1) * Math.cos(a1), Math.sin(b1), Math.cos(b1) * Math.sin(a1)] as const
      const f2 = [Math.cos(b2) * Math.cos(a2), Math.sin(b2), Math.cos(b2) * Math.sin(a2)] as const
      const band = Math.sin(time * 2.2)
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const ring = (head: number, n: number, width: number): number => {
        let distance = Math.abs(n - head)
        if (distance > count - distance) distance = count - distance
        const v = Math.max(0, 1 - distance / width)
        return v * v
      }
      const points: { x: number; y: number; r: number; a: number; l: number; depth: number }[] = []
      DOTS.forEach((dot, n) => {
        let pulse = 0
        if ((weights[0] ?? 0) > 0.001) pulse = Math.max(pulse, ring(head0, n, 10) * (weights[0] ?? 0))
        if ((weights[1] ?? 0) > 0.001) {
          const v1 = Math.max(0, (dot.x * f1[0] + dot.y * f1[1] + dot.z * f1[2] - 0.72) / 0.28)
          const v2 = Math.max(0, (dot.x * f2[0] + dot.y * f2[1] + dot.z * f2[2] - 0.72) / 0.28)
          const v = Math.max(v1, v2)
          pulse = Math.max(pulse, v * v * (weights[1] ?? 0))
        }
        if ((weights[2] ?? 0) > 0.001) {
          const e = dot.y - band
          const v = Math.max(0, 1 - (e * e) / 0.04)
          pulse = Math.max(pulse, v * v * (weights[2] ?? 0))
        }
        if ((weights[3] ?? 0) > 0.001) pulse = Math.max(pulse, ring(head3, n, 14) * (weights[3] ?? 0))
        const l = Math.max((lit[n] ?? 0) * decay, pulse)
        lit[n] = l
        const x1 = dot.x * cos + dot.z * sin
        const z1 = -dot.x * sin + dot.z * cos
        const y2 = dot.y * Math.cos(TILT) - z1 * Math.sin(TILT)
        const z2 = dot.y * Math.sin(TILT) + z1 * Math.cos(TILT)
        const perspective = 2.8 / (2.8 - z2)
        const depth = (z2 + 1) / 2
        const alpha = Math.min(1, 0.12 + 0.035 * Math.sin(dot.seed + time * 1.6) + 0.35 * depth * depth + 0.75 * l)
        points.push({
          x: center + x1 * sphere * perspective,
          y: center - y2 * sphere * perspective,
          r: Math.max(0.6, (1.15 * (0.45 + 0.75 * depth) * perspective + 0.9 * l) * dotScale * 2.2),
          a: alpha,
          l,
          depth
        })
      })
      // Moitié arrière d'abord, puis moitié avant.
      points.sort((a, b) => a.depth - b.depth)
      for (const point of points) {
        const mix = Math.min(1, point.l * 1.4)
        const r = Math.round(base[0] + (light[0] - base[0]) * mix)
        const g = Math.round(base[1] + (light[1] - base[1]) * mix)
        const b = Math.round(base[2] + (light[2] - base[2]) * mix)
        context.fillStyle = `rgba(${r},${g},${b},${point.a.toFixed(3)})`
        context.beginPath()
        context.arc(point.x, point.y, point.r, 0, TAU)
        context.fill()
      }
    }

    const loop = (now: number): void => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      // Le thème peut changer pendant la réflexion : jetons relus environ chaque seconde.
      if ((tick += 1) % 60 === 0) {
        base = tokenColor(canvas, '--color-content-muted', base)
        light = tokenColor(canvas, '--color-accent', light)
      }
      draw(dt)
      frame = requestAnimationFrame(loop)
    }

    if (reduced) draw(0)
    else frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [reduced, size])

  return <canvas ref={canvasRef} aria-hidden="true" style={{ width: size, height: size }} className="shrink-0" />
}
