/**
 * Illustration du panneau arrière d'un dossier (spec 028 D5, research R5) : une « encre » générée, teintée de la
 * couleur du nœud et déclinée par son identifiant — chaque dossier est unique, son module se reconnaît. Le calcul est
 * pur et découpé en tranches de lignes (`step`) ; une file unique, partagée par tous les dossiers de la carte, dépense
 * quelques millisecondes par image et garde le résultat en cache. Aucune ressource externe.
 */

export interface ArtPalette {
  /** Teintes du fond, de la plus sombre à la plus claire (RVB). */
  readonly stops: readonly (readonly [number, number, number])[]
}

/** Hachage FNV-1a d'une chaîne : la graine d'un dossier suit l'identifiant de son nœud. */
export function seedOf(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return hash >>> 0
}

/** Générateur pseudo-aléatoire à graine (xorshift32) : mêmes formes pour la même graine. */
function random(seed: number): () => number {
  let state = seed === 0 ? 0x9e3779b9 : seed >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

const clamp = (value: number, low = 0, high = 1): number => (value < low ? low : value > high ? high : value)

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '')
  const full = clean.length === 3 ? [...clean].map((digit) => digit + digit).join('') : clean
  const value = /^[0-9a-f]{6}$/i.test(full) ? Number.parseInt(full, 16) : 0x71717a
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function rgbToHsl([r, g, b]: readonly [number, number, number]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const light = (max + min) / 2
  if (max === min) return [0, 0, light]
  const delta = max - min
  const saturation = light > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue =
    max === rn
      ? ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6
      : max === gn
        ? ((bn - rn) / delta + 2) / 6
        : ((rn - gn) / delta + 4) / 6
  return [hue, saturation, light]
}

function hslToRgb(hue: number, saturation: number, light: number): [number, number, number] {
  const channel = (offset: number): number => {
    const k = (offset + hue * 12) % 12
    const a = saturation * Math.min(light, 1 - light)
    return Math.round(255 * (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [channel(0), channel(8), channel(4)]
}

/**
 * Six teintes tirées de la couleur du nœud : une nuit et une ombre de sa teinte, la couleur elle-même, une lumière,
 * une teinte voisine assourdie (le contrepoint) et un blanc teinté — assez de contraste pour que l'encre se lise.
 */
export function paletteOf(color: string): ArtPalette {
  const [hue, saturation] = rgbToHsl(hexToRgb(color))
  const tint = Math.max(saturation, 0.35)
  const turn = (hue + 0.42) % 1
  return {
    stops: [
      hslToRgb(hue, tint * 0.7, 0.1),
      hslToRgb(hue, tint, 0.26),
      hslToRgb(hue, tint, 0.48),
      hslToRgb(turn, tint * 0.45, 0.38),
      hslToRgb(hue, tint * 0.8, 0.7),
      hslToRgb(hue, tint * 0.35, 0.93)
    ]
  }
}

/** Bruit de valeurs lissé sur une grille 256 × 256 à graine, sommé en octaves (chaque octave tournée). */
function makeNoise(seed: number): (x: number, y: number) => number {
  const next = random(seed)
  const values = Float32Array.from({ length: 256 * 256 }, () => next() * 2 - 1)
  const at = (x: number, y: number): number => values[((y & 255) << 8) | (x & 255)] ?? 0
  const smooth = (t: number): number => t * t * (3 - 2 * t)
  const single = (x: number, y: number): number => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const u = smooth(x - x0)
    const v = smooth(y - y0)
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * u
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * u
    return top + (bottom - top) * v
  }
  return (x, y) => {
    let sum = 0
    let weight = 0.5
    let px = x
    let py = y
    for (let octave = 0; octave < 4; octave++) {
      sum += weight * single(px, py)
      const rx = px * 0.8 - py * 0.6
      py = px * 0.6 + py * 0.8
      px = rx * 2.03 + 17.3
      py = py * 2.03 + 5.1
      weight *= 0.5
    }
    return sum
  }
}

export interface ArtJob {
  readonly width: number
  readonly height: number
  /** RVBA, prêt pour `ImageData`. */
  readonly pixels: Uint8ClampedArray
  /** Calcule jusqu'à `rows` lignes de plus ; `true` quand l'image est finie. */
  step(rows: number): boolean
}

/**
 * L'encre : un champ de bruit déformé deux fois (chaque déformation nourrit la suivante), étalé sur toute la palette
 * par ses bornes, puis éclairé comme une surface (sa pente donne la lumière et un reflet serré), avec de fines stries.
 */
export function createArtJob(width: number, height: number, palette: ArtPalette, seed: number): ArtJob {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const noise = makeNoise(seed)
  const offsets = random(seed ^ 0x5bd1e995)
  const ox = offsets() * 64
  const oy = offsets() * 64
  const angle = offsets() * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const scale = 2.6 / Math.min(w, h)
  const field = new Float32Array(w * h)
  const pixels = new Uint8ClampedArray(w * h * 4)
  const stops = palette.stops.length >= 2 ? palette.stops : [[20, 20, 24] as const, [235, 235, 240] as const]
  let row = 0

  const sample = (x: number, y: number): number => {
    const u = (x * cos - y * sin) * scale + ox
    const v = (x * sin + y * cos) * scale + oy
    const qx = noise(u, v)
    const qy = noise(u + 4.7, v + 1.9)
    const rx = noise(u + 2.6 * qx + 8.1, v + 2.6 * qy + 3.4)
    const ry = noise(u + 2.6 * qx + 1.3, v + 2.6 * qy + 9.6)
    return noise(u + 2.2 * rx, v + 2.2 * ry)
  }

  const shade = (): void => {
    let low = Infinity
    let high = -Infinity
    for (let index = 0; index < field.length; index += 7) {
      const value = field[index] ?? 0
      if (value < low) low = value
      if (value > high) high = value
    }
    const span = high - low || 1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const index = y * w + x
        const t = clamp(((field[index] ?? 0) - low) / span)
        const position = t * (stops.length - 1)
        const lower = Math.min(stops.length - 2, Math.floor(position))
        const mix = position - lower
        const blend = mix * mix * (3 - 2 * mix)
        const a = stops[lower] ?? stops[0]
        const b = stops[lower + 1] ?? a
        const dx = (field[x < w - 1 ? index + 1 : index] ?? 0) - (field[x > 0 ? index - 1 : index] ?? 0)
        const dy = (field[y < h - 1 ? index + w : index] ?? 0) - (field[y > 0 ? index - w : index] ?? 0)
        const slope = 18 / span
        const facing = clamp(0.5 + (-dx * 0.6 - dy * 0.7) * slope, 0, 1)
        const light = 0.8 + 0.32 * facing
        const gloss = Math.pow(facing, 18) * 90
        const streak = 1 + 0.03 * Math.sin(t * 140)
        for (let channel = 0; channel < 3; channel++) {
          const base = (a?.[channel] ?? 0) + ((b?.[channel] ?? 0) - (a?.[channel] ?? 0)) * blend
          pixels[index * 4 + channel] = base * light * streak + gloss
        }
        pixels[index * 4 + 3] = 255
      }
    }
  }

  return {
    width: w,
    height: h,
    pixels,
    step(rows) {
      if (row >= h) return true
      const end = Math.min(h, row + Math.max(1, rows))
      for (; row < end; row++) for (let x = 0; x < w; x++) field[row * w + x] = sample(x, row)
      if (row < h) return false
      shade()
      return true
    }
  }
}

/** Budget de calcul par image pour toutes les illustrations en attente (la carte reste fluide). */
export const PAINT_BUDGET_MS = 6

interface Pending {
  readonly job: ArtJob
  readonly done: (pixels: ImageData | null) => void
}

const queue: Pending[] = []
const cache = new Map<string, Promise<ImageData | null>>()
/** Illustrations finies : un dossier redessiné (zoom, déplacement) les affiche aussitôt, sans fondu. */
const painted = new Map<string, ImageData>()

const artKey = (color: string, seed: number, width: number, height: number): string =>
  `${color}|${seed}|${Math.round(width)}x${Math.round(height)}`

/** Illustration déjà peinte, ou `undefined`. */
export function paintedArt(color: string, seed: number, width: number, height: number): ImageData | undefined {
  return painted.get(artKey(color, seed, width, height))
}
let pumping = false

function pump(): void {
  if (pumping) return
  pumping = true
  const tick = (): void => {
    const until = performance.now() + PAINT_BUDGET_MS
    while (queue.length > 0 && performance.now() < until) {
      const head = queue[0]
      if (head === undefined || !head.job.step(3)) continue
      queue.shift()
      const { width, height, pixels } = head.job
      head.done(typeof ImageData === 'undefined' ? null : new ImageData(new Uint8ClampedArray(pixels), width, height))
    }
    if (queue.length > 0) requestAnimationFrame(tick)
    else pumping = false
  }
  requestAnimationFrame(tick)
}

/** Illustration d'un dossier, calculée une fois par (couleur, graine, taille) pour la session. */
export function paintArt(color: string, seed: number, width: number, height: number): Promise<ImageData | null> {
  const key = artKey(color, seed, width, height)
  let pending = cache.get(key)
  if (pending === undefined) {
    pending = new Promise((done) => {
      queue.push({
        job: createArtJob(width, height, paletteOf(color), seed),
        done: (image) => {
          if (image !== null) painted.set(key, image)
          done(image)
        }
      })
      pump()
    })
    cache.set(key, pending)
  }
  return pending
}
