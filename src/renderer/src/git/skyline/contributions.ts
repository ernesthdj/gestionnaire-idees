/**
 * Calculs purs de la Skyline des contributions (spec 021 D16) : jours, grille d'un an (colonnes = semaines, lignes =
 * jours, lundi en haut), niveaux, statistiques, caméra entre la vue à plat (2D) et le relief isométrique (3D).
 * Principe repris du composant « Contribution Skyline » de 21st.dev (kedhareswer), réécrit pour l'app.
 */

export const DAY_MS = 86_400_000

export interface Cell {
  readonly date: string
  readonly count: number
  readonly level: number
  readonly week: number
  readonly day: number
}

export interface Streak {
  readonly days: number
  readonly start: string | null
  readonly end: string | null
}

export interface SkylineStats {
  readonly total: number
  readonly busiest: { readonly count: number; readonly date: string | null }
  readonly longest: Streak
  readonly current: Streak
}

export interface Grid {
  readonly cells: readonly Cell[]
  readonly weeks: number
  readonly max: number
}

export const clamp01 = (value: number): number => (value > 0 ? (value < 1 ? value : 1) : 0)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const easeInOutCubic = (x: number): number => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3)
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Minuit UTC → « AAAA-MM-JJ ». */
export const toKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

/** Date ISO d'un commit → minuit UTC de son jour calendaire LOCAL (un commit à 23 h reste sur son jour). */
export function dayOf(iso: string): number {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return Number.NaN
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

/** « AAAA-MM-JJ » lu tel quel (aucun décalage de fuseau). */
export const keyMs = (key: string): number => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  return match === null ? Number.NaN : Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** Commits par jour (clé « AAAA-MM-JJ »). */
export function countByDay(dates: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const iso of dates) {
    const ms = dayOf(iso)
    if (!Number.isFinite(ms)) continue
    const key = toKey(ms)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** 0 pour un jour vide, sinon 1 à 4 par quarts de `busy` (au-delà de `busy` : 4). */
export const levelOf = (count: number, busy: number): number =>
  count <= 0 ? 0 : busy <= 0 ? 4 : 1 + Math.min(3, Math.floor((count / busy) * 4))

/**
 * La grille d'un an finissant le jour `endMs`, commencée le lundi de la semaine d'il y a un an. Les niveaux se calculent
 * sur le 95e centile des jours actifs : un jour exceptionnel n'écrase pas tous les autres au niveau 1.
 */
export function buildGrid(counts: ReadonlyMap<string, number>, endMs: number): Grid {
  let start = endMs - 364 * DAY_MS
  start -= ((new Date(start).getUTCDay() + 6) % 7) * DAY_MS
  const raw: { date: string; count: number; week: number; day: number }[] = []
  for (let ms = start, index = 0; ms <= endMs; ms += DAY_MS, index += 1) {
    const date = toKey(ms)
    raw.push({ date, count: counts.get(date) ?? 0, week: Math.floor(index / 7), day: index % 7 })
  }
  const active = raw
    .map((cell) => cell.count)
    .filter((count) => count > 0)
    .sort((a, b) => a - b)
  const busy = active[Math.floor(0.95 * (active.length - 1))] ?? 0
  return {
    cells: raw.map((cell) => ({ ...cell, level: levelOf(cell.count, busy) })),
    weeks: (raw.at(-1)?.week ?? -1) + 1,
    max: active.at(-1) ?? 0
  }
}

/** Total, jour le plus chargé, plus longue série, et série en cours (jusqu'au dernier jour ou la veille). */
export function computeStats(cells: readonly Cell[]): SkylineStats {
  let total = 0
  let busiest: { count: number; date: string | null } = { count: 0, date: null }
  let run = 0
  let runStart: string | null = null
  let longest: Streak = { days: 0, start: null, end: null }
  for (const cell of cells) {
    total += cell.count
    if (cell.count > busiest.count) busiest = { count: cell.count, date: cell.date }
    if (cell.count > 0) {
      if (run === 0) runStart = cell.date
      run += 1
      if (run > longest.days) longest = { days: run, start: runStart, end: cell.date }
    } else run = 0
  }
  let last = cells.length - 1
  if ((cells[last]?.count ?? 0) === 0) last -= 1
  let first = last
  while (first >= 0 && (cells[first]?.count ?? 0) > 0) first -= 1
  const days = last - first
  const current: Streak =
    days > 0
      ? { days, start: cells[first + 1]?.date ?? null, end: cells[last]?.date ?? null }
      : { days: 0, start: null, end: null }
  return { total, busiest, longest, current }
}

/** Un libellé par semaine qui ouvre un mois ; le premier saute s'il est trop serré. */
export function monthLabels(cells: readonly Cell[], weeks: number): { week: number; label: string }[] {
  const format = new Intl.DateTimeFormat('fr-BE', { month: 'short', timeZone: 'UTC' })
  const labels: { week: number; label: string }[] = []
  let previous = -1
  for (let week = 0; week < weeks; week += 1) {
    const cell = cells[week * 7]
    if (cell === undefined) break
    const month = Number(cell.date.slice(5, 7))
    if (month !== previous) labels.push({ week, label: format.format(keyMs(cell.date)) })
    previous = month
  }
  if (labels.length > 1 && (labels[1]?.week ?? 0) - (labels[0]?.week ?? 0) < 3) labels.shift()
  return labels
}

/** Hauteur d'une barre en unités de grille : dalle fine pour un jour vide, ~7,6 cases pour le plus chargé. */
export const barHeight = (count: number, max: number): number =>
  count > 0 && max > 0 ? 0.4 + Math.pow(count / max, 0.85) * 7.2 : 0.2

/** Part du passage 2D → 3D que chaque barre attend : la vague va de la semaine la plus ancienne à la plus récente. */
const WAVE = 0.42

/** 0 → 1 quand une barre se lève ; toutes à plat à t = 0, toutes levées à t = 1. */
export function riseAt(t: number, week: number, weeks: number, day: number): number {
  const delay = (weeks > 1 ? week / (weeks - 1) : 0) * 0.36 + (day / 6) * 0.06
  return easeOutCubic((t - delay) / (1 - WAVE))
}

export const YAW_3D = Math.PI / 4
export const ELEV_3D = (34 * Math.PI) / 180
export const YAW_RANGE: readonly [number, number] = [(8 * Math.PI) / 180, (82 * Math.PI) / 180]
export const ELEV_RANGE: readonly [number, number] = [(18 * Math.PI) / 180, (62 * Math.PI) / 180]

export interface Camera {
  readonly cs: number
  readonly sn: number
  readonly se: number
  readonly ce: number
}

/**
 * e = 0 : vue de dessus (lacet 0, élévation 90°), la carte de chaleur ; e = 1 : le coin isométrique. L'orbite ne
 * s'applique qu'en proportion de e : la vue à plat ne penche jamais.
 */
export function camera(e: number, dYaw = 0, dElev = 0): Camera {
  const yaw = Math.min(YAW_RANGE[1], Math.max(0, lerp(0, YAW_3D + dYaw, e)))
  const elev = lerp(Math.PI / 2, Math.min(ELEV_RANGE[1], Math.max(ELEV_RANGE[0], ELEV_3D + dElev)), e)
  return { cs: Math.cos(yaw), sn: Math.sin(yaw), se: Math.sin(elev), ce: Math.cos(elev) }
}

/** Monde (x = semaine, y = jour, z = hauteur) → écran, avant échelle et décalage. */
export const project = (cam: Camera, x: number, y: number, z: number): readonly [number, number] => [
  x * cam.cs - y * cam.sn,
  (x * cam.sn + y * cam.cs) * cam.se - z * cam.ce
]
