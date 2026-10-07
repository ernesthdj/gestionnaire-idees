import { z } from 'zod'
import { PROBE_FAMILIES, PROBE_LIMITS } from '@shared/analyste/events'
import {
  ANALYSTE_SETTINGS_LIMITS as LIMITS,
  OBSERVATIONS_PAGE_LIMIT,
  type AnalysteSettingsView,
  type AnalysteStatusView,
  type ObservationsPageView,
  type ObservationView
} from '@shared/ipc/analyste'
import type { ProbeFamily } from '@shared/analyste/events'
import type { RepoState } from '../application/analyste/RepoGuard'
import { AppError } from '../domain/errors'
import { defineRoute, type IpcRoute } from './registry'

export interface AnalysteRoutesDeps {
  readonly guard: { current(): RepoState; designate(dir: string): Promise<RepoState> }
  readonly probe: { recordRenderer(events: readonly unknown[]): { accepted: number }; dropped(): number; flush(): void }
  readonly observations: {
    page(query: { family?: ProbeFamily; from?: number; to?: number; cursor?: number; limit: number }): {
      items: ObservationView[]
      next: number | null
    }
    totals(): Record<ProbeFamily, number>
    count(): number
    all(): ObservationView[]
    clear(): number
  }
  readonly settings: {
    settings(): AnalysteSettingsView
    updateSettings(patch: Partial<AnalysteSettingsView>): AnalysteSettingsView
  }
  /** Dossier choisi au sélecteur natif du main ; `undefined` si annulé. */
  readonly pickRepo: () => Promise<string | undefined>
  /** Fichier d'export choisi au dialogue natif du main ; `undefined` si annulé. */
  readonly pickExportFile: () => Promise<string | undefined>
  readonly writeFile: (path: string, content: string) => void
}

// Canal sans paramètre : l'interface n'envoie rien (convention des autres canaux).
const Empty = z.undefined()
const Millis = z.int().min(0)

/**
 * Canaux `analyste:*` de la sonde (spec 019 US1, contracts/interfaces.md). Le dépôt et le fichier d'export ne viennent
 * jamais de l'interface : ils sont choisis dans un dialogue natif du main.
 */
export function createAnalysteRoutes(deps: AnalysteRoutesDeps): IpcRoute[] {
  const available = (): void => {
    if (!deps.guard.current().available) {
      throw new AppError('PACKAGED_APP', "L'Analyste n'existe pas dans l'app installée")
    }
  }
  const status = (): AnalysteStatusView => {
    const state = deps.guard.current()
    return {
      ...state,
      observations: state.available ? deps.observations.count() : 0,
      dropped: deps.probe.dropped()
    }
  }

  return [
    defineRoute({ channel: 'analyste:repo:status', input: Empty, handler: async () => status() }),
    defineRoute({
      channel: 'analyste:repo:choose',
      input: Empty,
      handler: async () => {
        available()
        const dir = await deps.pickRepo()
        if (dir === undefined) throw new AppError('CANCELLED', 'Aucun dossier choisi')
        await deps.guard.designate(dir)
        return status()
      }
    }),
    defineRoute({
      channel: 'analyste:events',
      input: z.strictObject({ events: z.array(z.unknown()).max(PROBE_LIMITS.batch) }),
      handler: async ({ events }) => {
        const { accepted } = deps.probe.recordRenderer(events)
        return { accepted }
      }
    }),
    defineRoute({
      channel: 'analyste:observations',
      input: z.strictObject({
        family: z.enum(PROBE_FAMILIES).optional(),
        from: Millis.optional(),
        to: Millis.optional(),
        cursor: z.int().min(1).optional(),
        limit: z.int().min(1).max(OBSERVATIONS_PAGE_LIMIT).default(OBSERVATIONS_PAGE_LIMIT)
      }),
      handler: async ({ family, from, to, cursor, limit }): Promise<ObservationsPageView> => {
        available()
        // Ce qui est en file est écrit d'abord : la vue montre tout ce que la sonde a gardé.
        deps.probe.flush()
        const page = deps.observations.page({
          limit,
          ...(family === undefined ? {} : { family }),
          ...(from === undefined ? {} : { from }),
          ...(to === undefined ? {} : { to }),
          ...(cursor === undefined ? {} : { cursor })
        })
        return { ...page, totals: deps.observations.totals() }
      }
    }),
    defineRoute({
      channel: 'analyste:observations:export',
      input: Empty,
      handler: async () => {
        available()
        deps.probe.flush()
        const file = await deps.pickExportFile()
        if (file === undefined) throw new AppError('CANCELLED', 'Export annulé')
        const items = deps.observations.all()
        deps.writeFile(file, JSON.stringify({ version: 1, observations: items }, null, 2))
        return { count: items.length }
      }
    }),
    defineRoute({
      channel: 'analyste:purge',
      input: z.strictObject({ confirm: z.literal(true) }),
      handler: async () => {
        available()
        deps.probe.flush()
        return { deleted: deps.observations.clear() }
      }
    }),
    defineRoute({ channel: 'analyste:settings:get', input: Empty, handler: async () => deps.settings.settings() }),
    defineRoute({
      channel: 'analyste:settings:set',
      input: z.strictObject({
        retentionDays: z.int().min(LIMITS.retentionDays.min).max(LIMITS.retentionDays.max).optional(),
        maxEvents: z.int().min(LIMITS.maxEvents.min).max(LIMITS.maxEvents.max).optional()
      }),
      handler: async (patch) => {
        available()
        return deps.settings.updateSettings({
          ...(patch.retentionDays === undefined ? {} : { retentionDays: patch.retentionDays }),
          ...(patch.maxEvents === undefined ? {} : { maxEvents: patch.maxEvents })
        })
      }
    })
  ]
}
