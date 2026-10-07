import { familyOf, RendererProbeEvent, type ObservationRecord, type ProbeSubjectKind } from '@shared/analyste/events'
import type { AnalysteSettingsView } from '@shared/ipc/analyste'
import { pseudonym } from '../../domain/analyste/fingerprint'

const DAY_MS = 86_400_000

/** Bornes de la file en mémoire (spec 019 research R10). */
export const PROBE_QUEUE = {
  flushMs: 2_000,
  purgeMs: 3_600_000,
  /** Au-delà, les actions et navigations identiques consécutives sont regroupées. */
  merge: 2_000,
  /** Au-delà, les nouveaux événements sont abandonnés et comptés. */
  max: 5_000
} as const

/** Observation reçue avant pseudonymisation : l'identifiant d'un objet n'est jamais stocké. */
export type ProbeInput = Omit<ObservationRecord, 'at' | 'subjectRef'> & { readonly subjectId?: string }

export interface ProbeServiceDeps {
  readonly key: () => string | null
  readonly repository: {
    insertBatch(records: readonly ObservationRecord[]): void
    purge(olderThan: number, maxEvents: number): number
    count(): number
  }
  readonly settings: () => Pick<AnalysteSettingsView, 'retentionDays' | 'maxEvents'>
  readonly now?: () => number
  readonly timers?: {
    readonly every: (ms: number, run: () => void) => unknown
    readonly cancel: (handle: unknown) => void
  }
  /** Revérification périodique du dépôt (research R12). */
  readonly recheck?: () => Promise<unknown>
}

const MERGEABLE = new Set(['action', 'navigation'])
const LOG_EVENT = /^[A-Za-z][A-Za-z0-9_.]{0,47}$/
const CHANNEL = /^[a-z][A-Za-z0-9]{0,23}:[A-Za-z0-9]{1,24}$/

const sameEvent = (a: ObservationRecord, b: ObservationRecord): boolean =>
  a.event === b.event &&
  a.screen === b.screen &&
  a.subjectKind === b.subjectKind &&
  a.subjectRef === b.subjectRef &&
  a.via === b.via

/**
 * Sonde (spec 019 US1) : reçoit les événements du main et de l'interface, les pseudonymise, les garde en file et les
 * écrit par lots. Inactive sans clé (dépôt non désigné ou en pause). Une erreur de la sonde est comptée, jamais
 * remontée : l'observation ne doit pas changer ce qu'elle observe.
 */
export class ProbeService {
  private queue: ObservationRecord[] = []
  private droppedCount = 0
  private handles: unknown[] = []

  constructor(private readonly deps: ProbeServiceDeps) {}

  /** Événement produit par le main (journal, mesure des canaux). */
  record(input: ProbeInput): void {
    const key = this.deps.key()
    if (key === null) return
    const { subjectId, ...rest } = input
    this.enqueue({
      ...rest,
      at: this.now(),
      ...(subjectId === undefined ? {} : { subjectRef: pseudonym(key, subjectId) })
    })
  }

  /** Avertissement ou erreur du journal du main (liste blanche du journal déjà appliquée). */
  recordLog(level: 'info' | 'warn' | 'error', event: string): void {
    if (level === 'info' || !LOG_EVENT.test(event)) return
    this.record({ family: 'erreur', event: 'error.main', code: event, module: event.split('.')[0] ?? event })
  }

  /** Durée d'un appel de canal ; les canaux de l'Analyste ne s'observent pas eux-mêmes. */
  recordCall(channel: string, durationMs: number, ok: boolean): void {
    if (channel.startsWith('analyste:') || !CHANNEL.test(channel)) return
    this.record({ family: 'performance', event: 'ipc.call', channel, durationMs, status: ok ? 'ok' : 'error' })
  }

  /** Lot envoyé par l'interface : chaque événement est validé seul, les fautifs sont ignorés et comptés. */
  recordRenderer(events: readonly unknown[]): { accepted: number; dropped: number } {
    if (this.deps.key() === null) return { accepted: 0, dropped: 0 }
    let accepted = 0
    for (const raw of events) {
      const parsed = RendererProbeEvent.safeParse(raw)
      if (!parsed.success) {
        this.droppedCount += 1
        continue
      }
      const event = parsed.data
      const family = familyOf(event.event)
      if (event.event === 'screen.open') this.record({ family, event: event.event, screen: event.screen })
      else if (event.event === 'panel.close')
        this.record({ family, event: event.event, screen: event.screen, durationMs: event.durationMs })
      else if (event.event === 'error.renderer')
        this.record({ family, event: event.event, code: event.code, frames: event.frames })
      else
        this.record({
          family,
          event: event.event,
          subjectKind: event.subjectKind satisfies ProbeSubjectKind,
          via: event.via,
          ...(event.subjectId === undefined ? {} : { subjectId: event.subjectId })
        })
      accepted += 1
    }
    return { accepted, dropped: events.length - accepted }
  }

  flush(): void {
    if (this.queue.length === 0) return
    const batch = this.queue
    this.queue = []
    try {
      this.deps.repository.insertBatch(batch)
    } catch {
      this.droppedCount += batch.length
    }
  }

  purge(): void {
    try {
      const { retentionDays, maxEvents } = this.deps.settings()
      this.deps.repository.purge(this.now() - retentionDays * DAY_MS, maxEvents)
    } catch {
      // Purge reprise à la prochaine heure.
    }
  }

  start(): void {
    const timers = this.deps.timers
    if (timers === undefined || this.handles.length > 0) return
    this.purge()
    this.handles = [
      timers.every(PROBE_QUEUE.flushMs, () => this.flush()),
      timers.every(PROBE_QUEUE.purgeMs, () => {
        this.purge()
        void this.deps.recheck?.().catch(() => undefined)
      })
    ]
  }

  stop(): void {
    for (const handle of this.handles) this.deps.timers?.cancel(handle)
    this.handles = []
    this.flush()
  }

  dropped(): number {
    return this.droppedCount
  }

  private enqueue(record: ObservationRecord): void {
    const last = this.queue.at(-1)
    if (
      this.queue.length >= PROBE_QUEUE.merge &&
      last !== undefined &&
      MERGEABLE.has(record.family) &&
      sameEvent(last, record)
    ) {
      this.queue[this.queue.length - 1] = { ...last, count: (last.count ?? 1) + 1 }
      return
    }
    if (this.queue.length >= PROBE_QUEUE.max) {
      this.droppedCount += 1
      return
    }
    this.queue.push(record)
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }
}
