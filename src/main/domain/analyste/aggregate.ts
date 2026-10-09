import { PROBE_ACTIONS, PROBE_SCREENS, type ObservationRecord, type ProbeScreen } from '@shared/analyste/events'

/**
 * Agrégats de la sonde (spec 019 FR-013, `L3-analyste-analyse.md` §3) : ce que l'Analyste reçoit à la place des
 * événements bruts. Chaque agrégat a une clé citable `obs:<type>:<n>`, une ligne technique pour le dossier, une phrase
 * lisible pour la fiche et une signature stable d'une analyse à l'autre (mémoire des refus, FR-018).
 */

export const AGGREGATE_TYPES = ['err', 'lent', 'ia', 'aller', 'seq', 'inutil', 'compte'] as const
export type AggregateType = (typeof AGGREGATE_TYPES)[number]

export interface AggregateEntry {
  /** Clé citable dans une proposition : `obs:err:1`. */
  readonly key: string
  readonly type: AggregateType
  /** Ligne technique envoyée dans le dossier. */
  readonly line: string
  /** Phrase lisible affichée sur la fiche. */
  readonly sentence: string
  /** Fait observé, indépendant de la numérotation (ex. `err|TypeError||src/a.ts:3`). */
  readonly signature: string
}

/** Appel d'IA réduit à ses empreintes (aucun contenu). */
export interface AiCallFingerprint {
  readonly kind: string
  readonly inputFp: string
  readonly outputFp: string | null
}

export interface AggregateOptions {
  /** Répétitions d'une même entrée d'IA à partir desquelles le fait est signalé (FR-019, défaut 5). */
  readonly repeatThreshold: number
  /** Durée de la fenêtre, pour les phrases (« sur 7 jours »). */
  readonly windowMs: number
  /**
   * Observations de toute la période de rétention et durée réellement couverte (première observation → fin), pour les
   * faits « jamais ouvert / jamais faite » : la fenêtre depuis la dernière analyse peut ne durer que quelques minutes.
   * Absent : la fenêtre elle-même.
   */
  readonly history?: { readonly records: readonly ObservationRecord[]; readonly spanMs: number }
}

/** Durée d'observation en dessous de laquelle « jamais utilisé » ne veut rien dire : aucun fait `inutil`. */
export const UNUSED_MIN_SPAN_MS = 3 * 86_400_000

/** Seuils des agrégats de parcours et de lenteur. */
export const AGGREGATE_LIMITS = {
  /** Aller-retour A → B → A en moins de… */
  backAndForthMs: 10_000,
  /** Deux actions d'une même séquence sont espacées de moins de… */
  sequenceGapMs: 60_000,
  /** Occurrences minimales d'une séquence ou d'un aller-retour pour être signalés. */
  minOccurrences: 5,
  /** Un canal est lent si son 95e centile atteint… */
  slowP95Ms: 500,
  /** Agrégats gardés par type (les plus nombreux d'abord). */
  perType: 10
} as const

/** Tâches exclues des répétitions : l'Analyste ne s'analyse pas lui-même. */
const IGNORED_AI_KINDS = new Set(['analyste'])

const DAY_MS = 86_400_000

const plural = (n: number, word: string, many = `${word}s`): string => `${n} ${n > 1 ? many : word}`

const seconds = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`
}

/** Durée réelle, dans l'unité qui lui convient (minutes, heures, jours) : jamais arrondie à « 1 jour ». */
export const duration = (ms: number): string => {
  if (ms < 3_600_000) return plural(Math.max(1, Math.round(ms / 60_000)), 'minute')
  if (ms < DAY_MS) return plural(Math.round(ms / 3_600_000), 'heure')
  return plural(Math.round(ms / DAY_MS), 'jour')
}

const SCREEN_NAMES: Readonly<Record<ProbeScreen, string>> = {
  carte: 'la carte',
  a_valider: 'À valider',
  historique: 'l’Historique',
  reglages: 'les Réglages',
  chat: 'la conversation',
  explorateur: 'l’explorateur',
  analyste: 'l’Analyste',
  skills: 'les Skills',
  accueil: 'le Project Manager'
}

const ACTION_NAMES: Readonly<Record<string, string>> = {
  'neuron.create': 'idée créée',
  'neuron.remove': 'idée supprimée',
  'link.create': 'lien créé',
  'block.create': 'bloc posé',
  'history.undo': 'annulation',
  'chat.send': 'message envoyé',
  'plan.decide': 'plan décidé'
}

const actionName = (event: string): string => ACTION_NAMES[event] ?? event

/** Centile (méthode du rang le plus proche) d'une liste triée. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))] ?? 0
}

interface Draft {
  readonly type: AggregateType
  readonly weight: number
  readonly line: string
  readonly sentence: string
  readonly signature: string
}

const weightOf = (record: ObservationRecord): number => record.count ?? 1

function errors(records: readonly ObservationRecord[], windowMs: number): Draft[] {
  const groups = new Map<string, { code: string; module: string; frame: string; n: number; days: Set<number> }>()
  for (const record of records) {
    if (record.family !== 'erreur') continue
    const code = record.code ?? 'inconnu'
    const module = record.module ?? ''
    const frame = record.frames?.[0] ?? ''
    const id = `${code}|${module}|${frame}`
    const group = groups.get(id) ?? { code, module, frame, n: 0, days: new Set<number>() }
    group.n += weightOf(record)
    group.days.add(Math.floor(record.at / DAY_MS))
    groups.set(id, group)
  }
  return [...groups.entries()].map(([id, g]) => {
    const where = [g.module === '' ? '' : `module ${g.module}`, g.frame === '' ? '' : g.frame]
      .filter((part) => part !== '')
      .join(', ')
    return {
      type: 'err',
      weight: g.n,
      signature: `err|${id}`,
      line: `erreur ${g.code}${g.module === '' ? '' : ` module=${g.module}`}${g.frame === '' ? '' : ` cadre=${g.frame}`} ×${g.n} (${plural(g.days.size, 'jour')} distincts sur ${duration(windowMs)})`,
      sentence: `L’erreur ${g.code}${where === '' ? '' : ` (${where})`} est survenue ${plural(g.n, 'fois', 'fois')}, sur ${plural(g.days.size, 'jour')}.`
    }
  })
}

function slowness(records: readonly ObservationRecord[]): Draft[] {
  const byChannel = new Map<string, { durations: number[]; failures: number }>()
  for (const record of records) {
    if (record.event !== 'ipc.call' || record.channel === undefined || record.durationMs === undefined) continue
    const entry = byChannel.get(record.channel) ?? { durations: [], failures: 0 }
    entry.durations.push(record.durationMs)
    if (record.status === 'error') entry.failures += 1
    byChannel.set(record.channel, entry)
  }
  const drafts: Draft[] = []
  for (const [channel, { durations, failures }] of byChannel) {
    const sorted = [...durations].sort((a, b) => a - b)
    const p50 = percentile(sorted, 50)
    const p95 = percentile(sorted, 95)
    if (p95 < AGGREGATE_LIMITS.slowP95Ms) continue
    const failed = failures === 0 ? '' : `, ${plural(failures, 'échec')}`
    drafts.push({
      type: 'lent',
      weight: p95,
      signature: `lent|${channel}`,
      line: `ipc.call ${channel} p50=${seconds(p50)} p95=${seconds(p95)} ×${sorted.length}${failed}`,
      sentence: `L’échange ${channel} a répondu en ${seconds(p50)} (médiane) et ${seconds(p95)} (95 % des cas) sur ${plural(sorted.length, 'appel')}${failed}.`
    })
  }
  return drafts
}

function repeatedAi(calls: readonly AiCallFingerprint[], threshold: number): Draft[] {
  const groups = new Map<string, { kind: string; n: number; outputs: Set<string> }>()
  for (const call of calls) {
    if (IGNORED_AI_KINDS.has(call.kind) || call.outputFp === null) continue
    const id = `${call.kind}|${call.inputFp}`
    const group = groups.get(id) ?? { kind: call.kind, n: 0, outputs: new Set<string>() }
    group.n += 1
    group.outputs.add(call.outputFp)
    groups.set(id, group)
  }
  const drafts: Draft[] = []
  for (const [id, g] of groups) {
    // FR-019 : seule une même entrée rendue toujours de la même façon devient un fait « IA → code ».
    if (g.n < threshold || g.outputs.size !== 1) continue
    drafts.push({
      type: 'ia',
      weight: g.n,
      signature: `ia|${id}`,
      line: `tâche ${g.kind} : ${g.n} appels, 1 seule empreinte d'entrée → 1 seule empreinte de sortie`,
      sentence: `La tâche ${g.kind} a rendu ${plural(g.n, 'fois', 'fois')} la même réponse pour la même entrée.`
    })
  }
  return drafts
}

function backAndForth(records: readonly ObservationRecord[]): Draft[] {
  const opens = records.filter(
    (record): record is ObservationRecord & { screen: ProbeScreen } =>
      record.event === 'screen.open' && record.screen !== undefined
  )
  const pairs = new Map<string, { a: ProbeScreen; b: ProbeScreen; n: number }>()
  for (let i = 0; i + 2 < opens.length; i += 1) {
    const [first, second, third] = [opens[i], opens[i + 1], opens[i + 2]]
    if (first === undefined || second === undefined || third === undefined) continue
    if (first.screen === second.screen || third.screen !== first.screen) continue
    if (third.at - first.at >= AGGREGATE_LIMITS.backAndForthMs) continue
    const id = `${first.screen}|${second.screen}`
    const pair = pairs.get(id) ?? { a: first.screen, b: second.screen, n: 0 }
    pair.n += 1
    pairs.set(id, pair)
  }
  return [...pairs.entries()]
    .filter(([, pair]) => pair.n >= AGGREGATE_LIMITS.minOccurrences)
    .map(([id, pair]) => ({
      type: 'aller',
      weight: pair.n,
      signature: `aller|${id}`,
      line: `${pair.a} → ${pair.b} → ${pair.a} en moins de 10 s ×${pair.n}`,
      sentence: `Aller-retour rapide entre ${SCREEN_NAMES[pair.a]} et ${SCREEN_NAMES[pair.b]} (moins de 10 s), ${plural(pair.n, 'fois', 'fois')}.`
    }))
}

function sequences(records: readonly ObservationRecord[]): Draft[] {
  const actions = records.filter((record) => record.family === 'action')
  const counts = new Map<string, number>()
  for (let i = 0; i + 2 < actions.length; i += 1) {
    const [a, b, c] = [actions[i], actions[i + 1], actions[i + 2]]
    if (a === undefined || b === undefined || c === undefined) continue
    if (b.at - a.at >= AGGREGATE_LIMITS.sequenceGapMs || c.at - b.at >= AGGREGATE_LIMITS.sequenceGapMs) continue
    const id = `${a.event} → ${b.event} → ${c.event}`
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= AGGREGATE_LIMITS.minOccurrences)
    .map(([id, n]) => ({
      type: 'seq',
      weight: n,
      signature: `seq|${id}`,
      line: `${id} ×${n}`,
      sentence: `La suite « ${id.split(' → ').map(actionName).join(' → ')} » revient ${plural(n, 'fois', 'fois')}.`
    }))
}

function unused(records: readonly ObservationRecord[], spanMs: number): Draft[] {
  if (records.length === 0 || spanMs < UNUSED_MIN_SPAN_MS) return []
  const opened = new Set(records.filter((r) => r.event === 'screen.open').map((r) => r.screen))
  const done = new Set(records.filter((r) => r.family === 'action').map((r) => r.event))
  const span = duration(spanMs)
  return [
    ...PROBE_SCREENS.filter((screen) => !opened.has(screen)).map((screen): Draft => ({
      type: 'inutil',
      weight: 1,
      signature: `inutil|screen|${screen}`,
      line: `screen=${screen} jamais ouvert sur ${span}`,
      sentence: `L’écran ${SCREEN_NAMES[screen]} n’a jamais été ouvert sur ${span}.`
    })),
    ...PROBE_ACTIONS.filter((action) => !done.has(action)).map((action): Draft => ({
      type: 'inutil',
      weight: 1,
      signature: `inutil|action|${action}`,
      line: `action ${action} jamais faite sur ${span}`,
      sentence: `L’action « ${actionName(action)} » n’a jamais été faite sur ${span}.`
    }))
  ]
}

function counts(records: readonly ObservationRecord[]): Draft[] {
  const byEvent = new Map<string, number>()
  for (const record of records) byEvent.set(record.event, (byEvent.get(record.event) ?? 0) + weightOf(record))
  return [...byEvent.entries()].map(([event, n]) => ({
    type: 'compte',
    weight: n,
    signature: `compte|${event}`,
    line: `${event} ×${n}`,
    sentence: `${event} : ${plural(n, 'fois', 'fois')} sur la période.`
  }))
}

/**
 * Calcule les agrégats d'une fenêtre. Les observations sont triées par date ; chaque type est classé du plus fort au
 * plus faible puis numéroté (`obs:err:1` = l'erreur la plus fréquente).
 */
export function aggregate(
  records: readonly ObservationRecord[],
  aiCalls: readonly AiCallFingerprint[],
  options: AggregateOptions
): AggregateEntry[] {
  const sorted = [...records].sort((a, b) => a.at - b.at)
  const drafts: Readonly<Record<AggregateType, Draft[]>> = {
    err: errors(sorted, options.windowMs),
    lent: slowness(sorted),
    ia: repeatedAi(aiCalls, options.repeatThreshold),
    aller: backAndForth(sorted),
    seq: sequences(sorted),
    inutil: unused(options.history?.records ?? sorted, options.history?.spanMs ?? options.windowMs),
    compte: counts(sorted)
  }
  return AGGREGATE_TYPES.flatMap((type) =>
    [...drafts[type]]
      .sort((a, b) => b.weight - a.weight || (a.signature < b.signature ? -1 : 1))
      .slice(0, type === 'inutil' ? PROBE_SCREENS.length + PROBE_ACTIONS.length : AGGREGATE_LIMITS.perType)
      .map((draft, index) => ({
        key: `obs:${type}:${index + 1}`,
        type,
        line: draft.line,
        sentence: draft.sentence,
        signature: draft.signature
      }))
  )
}
