import { z } from 'zod'
import { PROBE_FAMILIES, PROBE_LIMITS } from '@shared/analyste/events'
import {
  ANALYSES_LIMIT,
  ANALYSTE_SETTINGS_LIMITS as LIMITS,
  OBSERVATIONS_PAGE_LIMIT,
  PROPOSAL_DECISIONS,
  PROPOSAL_TAB_NAMES,
  PROPOSAL_TABS,
  PROPOSALS_PAGE_LIMIT,
  type AnalysisView,
  type AnalysteSettingsView,
  type ProposalStatus,
  type ProposalTab,
  type ProposalView,
  type UpdateDiffView,
  type UpdateView,
  type AnalysteStatusView,
  type ObservationsPageView,
  type ObservationView
} from '@shared/ipc/analyste'
import type { ProbeFamily } from '@shared/analyste/events'
import type { RepoState } from '../application/analyste/RepoGuard'
import { nextStatus } from '../domain/analyste/transitions'
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
  /** Analyses (spec 019 US2). */
  readonly analyste: {
    analyze(options: { readonly force?: boolean }): { analysisId: string }
    cancel(analysisId: string): void
  }
  readonly store: {
    analyses(limit: number): AnalysisView[]
    proposals(statuses: readonly ProposalStatus[], limit: number): ProposalView[]
    proposal(id: string): ProposalView | undefined
    setStatus(id: string, status: ProposalStatus, refusalReason: string | null, at: number): void
    counts(): Record<ProposalTab, number>
    clearClosed(): number
  }
  readonly now?: () => number
  /** Mises à jour (spec 019 US4). */
  readonly updates?: {
    ofProposal(proposalId: string): UpdateView | null
    start(proposalId: string): Promise<UpdateView>
    finish(updateId: string): Promise<UpdateView>
    diff(updateId: string): Promise<UpdateDiffView>
    tryCommand(updateId: string): { command: string; folder: string }
    keep(updateId: string): Promise<UpdateView>
    discard(updateId: string, reason?: string): Promise<UpdateView>
  }
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
  const active = (): void => {
    available()
    if (!deps.guard.current().active) {
      throw new AppError('PROBE_INACTIVE', 'La sonde est inactive : désigne le dépôt dans Réglages › Analyste')
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
        maxEvents: z.int().min(LIMITS.maxEvents.min).max(LIMITS.maxEvents.max).optional(),
        maxProposals: z.int().min(LIMITS.maxProposals.min).max(LIMITS.maxProposals.max).optional(),
        repeatThreshold: z.int().min(LIMITS.repeatThreshold.min).max(LIMITS.repeatThreshold.max).optional(),
        minEvents: z.int().min(LIMITS.minEvents.min).max(LIMITS.minEvents.max).optional()
      }),
      handler: async (patch) => {
        available()
        const entries = Object.entries(patch).filter(([, value]) => value !== undefined)
        return deps.settings.updateSettings(Object.fromEntries(entries) as Partial<AnalysteSettingsView>)
      }
    }),
    defineRoute({
      channel: 'analyste:analyze',
      input: z.strictObject({ force: z.boolean().optional() }),
      handler: async ({ force }) => {
        active()
        return deps.analyste.analyze(force === undefined ? {} : { force })
      }
    }),
    defineRoute({
      channel: 'analyste:cancel',
      input: z.strictObject({ analysisId: z.uuid() }),
      handler: async ({ analysisId }) => {
        active()
        deps.analyste.cancel(analysisId)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'analyste:analyses',
      input: z.strictObject({ limit: z.int().min(1).max(ANALYSES_LIMIT).default(ANALYSES_LIMIT) }),
      handler: async ({ limit }) => {
        active()
        return deps.store.analyses(limit)
      }
    }),
    defineRoute({
      channel: 'analyste:proposals',
      input: z.strictObject({
        tab: z.enum(PROPOSAL_TAB_NAMES).default('todo'),
        limit: z.int().min(1).max(PROPOSALS_PAGE_LIMIT).default(PROPOSALS_PAGE_LIMIT)
      }),
      handler: async ({ tab, limit }) => {
        active()
        return { items: deps.store.proposals(PROPOSAL_TABS[tab], limit), counts: deps.store.counts() }
      }
    }),
    defineRoute({
      channel: 'analyste:decide',
      input: z.strictObject({
        id: z.uuid(),
        decision: z.enum(PROPOSAL_DECISIONS),
        reason: z.string().trim().max(200).optional()
      }),
      handler: async ({ id, decision, reason }) => {
        active()
        const proposal = deps.store.proposal(id)
        if (proposal === undefined) throw new AppError('NOT_FOUND', 'Proposition introuvable')
        const next = nextStatus(proposal.status, decision)
        if (next === null) throw new AppError('INVALID_TRANSITION', 'Cette décision n’est pas possible dans cet état')
        // La raison d'un refus est gardée ; reprendre une proposition l'efface.
        const reasonText =
          decision === 'refuse'
            ? reason === undefined || reason === ''
              ? null
              : reason
            : decision === 'resume'
              ? null
              : proposal.refusalReason
        deps.store.setStatus(id, next, reasonText, (deps.now ?? Date.now)())
        return deps.store.proposal(id) as ProposalView
      }
    }),
    ...updateRoutes(deps.updates, active),
    defineRoute({
      channel: 'analyste:proposals:clear',
      input: z.strictObject({ confirm: z.literal(true) }),
      handler: async () => {
        active()
        return { deleted: deps.store.clearClosed() }
      }
    })
  ]
}

/**
 * Mises à jour (US4, FR-027 à FR-039) : le renderer ne donne que des identifiants ; Garder et Jeter exigent
 * `confirm: true` (geste de mentalyas).
 */
function updateRoutes(updates: AnalysteRoutesDeps['updates'], active: () => void): IpcRoute[] {
  if (updates === undefined) return []
  const Id = z.uuid()
  return [
    defineRoute({
      channel: 'analyste:update:get',
      input: z.strictObject({ proposalId: Id }),
      handler: async ({ proposalId }) => {
        active()
        return updates.ofProposal(proposalId)
      }
    }),
    defineRoute({
      channel: 'analyste:update:start',
      input: z.strictObject({ proposalId: Id }),
      handler: async ({ proposalId }) => {
        active()
        return updates.start(proposalId)
      }
    }),
    defineRoute({
      channel: 'analyste:update:finish',
      input: z.strictObject({ updateId: Id }),
      handler: async ({ updateId }) => {
        active()
        return updates.finish(updateId)
      }
    }),
    defineRoute({
      channel: 'analyste:update:diff',
      input: z.strictObject({ updateId: Id }),
      handler: async ({ updateId }) => {
        active()
        return updates.diff(updateId)
      }
    }),
    defineRoute({
      channel: 'analyste:update:try',
      input: z.strictObject({ updateId: Id }),
      handler: async ({ updateId }) => {
        active()
        return updates.tryCommand(updateId)
      }
    }),
    defineRoute({
      channel: 'analyste:update:keep',
      input: z.strictObject({ updateId: Id, confirm: z.literal(true) }),
      handler: async ({ updateId }) => {
        active()
        return updates.keep(updateId)
      }
    }),
    defineRoute({
      channel: 'analyste:update:discard',
      input: z.strictObject({ updateId: Id, confirm: z.literal(true), reason: z.string().trim().max(200).optional() }),
      handler: async ({ updateId, reason }) => {
        active()
        return updates.discard(updateId, reason)
      }
    })
  ]
}
