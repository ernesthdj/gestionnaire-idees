import { and, desc, eq, inArray, max } from 'drizzle-orm'
import { z } from 'zod'
import {
  ANALYSTE_SETTINGS_LIMITS,
  PROPOSAL_STATUSES,
  type AnalysisView,
  type AnalysteSettingsView,
  type ProposalStatus,
  type ProposalView
} from '@shared/ipc/analyste'
import type { MemoryItem } from '../../../domain/analyste/dossier'
import type { CheckedProposal, ProposalMemory } from '../../../domain/analyste/proposalCheck'
import { OPEN_STATUSES } from '../../../domain/analyste/proposalCheck'
import type { AppDatabase } from '../client'
import { analyses, proposals } from '../schemaAnalyste'
import { settings } from '../schemaNeurons'

const LIMITS = ANALYSTE_SETTINGS_LIMITS

/** Réglages de l'Analyste (spec 019 data-model), une clé `settings` chacun, validés à la lecture comme à l'écriture. */
const FIELDS = {
  retentionDays: {
    key: 'analyste.retentionDays',
    schema: z.int().min(LIMITS.retentionDays.min).max(LIMITS.retentionDays.max)
  },
  maxEvents: { key: 'analyste.maxEvents', schema: z.int().min(LIMITS.maxEvents.min).max(LIMITS.maxEvents.max) },
  maxProposals: {
    key: 'analyste.maxProposals',
    schema: z.int().min(LIMITS.maxProposals.min).max(LIMITS.maxProposals.max)
  },
  repeatThreshold: {
    key: 'analyste.repeatThreshold',
    schema: z.int().min(LIMITS.repeatThreshold.min).max(LIMITS.repeatThreshold.max)
  },
  minEvents: { key: 'analyste.minEvents', schema: z.int().min(LIMITS.minEvents.min).max(LIMITS.minEvents.max) }
} as const

const REPO_KEY = 'analyste.repoPath'
const RepoSchema = z.string().min(1).max(1000)

const DEFAULTS: AnalysteSettingsView = {
  retentionDays: LIMITS.retentionDays.default,
  maxEvents: LIMITS.maxEvents.default,
  maxProposals: LIMITS.maxProposals.default,
  repeatThreshold: LIMITS.repeatThreshold.default,
  minEvents: LIMITS.minEvents.default
}

const safeJson = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

/** Preuves enregistrées : la signature d'un fait reste en base (mémoire des refus), jamais dans la vue. */
const StoredEvidence = z.object({
  observations: z.array(z.object({ key: z.string(), sentence: z.string(), signature: z.string().default('') })),
  code: z.array(z.object({ path: z.string(), start: z.int().optional(), end: z.int().optional() }))
})
type StoredEvidence = z.infer<typeof StoredEvidence>
const StoredFiles = z.array(z.string())
const EMPTY_EVIDENCE: StoredEvidence = { observations: [], code: [] }

const evidenceOf = (json: string): StoredEvidence => {
  const parsed = StoredEvidence.safeParse(safeJson(json))
  return parsed.success ? parsed.data : EMPTY_EVIDENCE
}
const filesOf = (json: string): string[] => {
  const parsed = StoredFiles.safeParse(safeJson(json))
  return parsed.success ? parsed.data : []
}

export interface NewAnalysis {
  readonly id: string
  readonly trigger: 'manual' | 'auto'
  readonly windowFrom: number
  readonly windowTo: number
  readonly events: number
  readonly startedAt: number
}

export interface NewProposal extends CheckedProposal {
  readonly id: string
}

export class AnalysteRepository {
  constructor(private readonly db: AppDatabase) {}

  settings(): AnalysteSettingsView {
    const read = (field: keyof typeof FIELDS): number => {
      const row = this.db.select().from(settings).where(eq(settings.key, FIELDS[field].key)).get()
      if (row === undefined) return DEFAULTS[field]
      const parsed = FIELDS[field].schema.safeParse(safeJson(row.valueJson))
      return parsed.success ? parsed.data : DEFAULTS[field]
    }
    return {
      retentionDays: read('retentionDays'),
      maxEvents: read('maxEvents'),
      maxProposals: read('maxProposals'),
      repeatThreshold: read('repeatThreshold'),
      minEvents: read('minEvents')
    }
  }

  /** Lève une erreur Zod si une valeur est hors bornes (rien n'est écrit). */
  updateSettings(patch: Partial<AnalysteSettingsView>): AnalysteSettingsView {
    const entries = (Object.keys(patch) as (keyof typeof FIELDS)[]).flatMap((field) => {
      const value = patch[field]
      return value === undefined
        ? []
        : [{ key: FIELDS[field].key, valueJson: JSON.stringify(FIELDS[field].schema.parse(value)) }]
    })
    this.db.transaction((tx) => {
      for (const entry of entries) {
        tx.insert(settings)
          .values(entry)
          .onConflictDoUpdate({ target: settings.key, set: { valueJson: entry.valueJson } })
          .run()
      }
    })
    return this.settings()
  }

  repoPath(): string | null {
    const row = this.db.select().from(settings).where(eq(settings.key, REPO_KEY)).get()
    if (row === undefined) return null
    const parsed = RepoSchema.safeParse(safeJson(row.valueJson))
    return parsed.success ? parsed.data : null
  }

  saveRepoPath(path: string): void {
    const valueJson = JSON.stringify(RepoSchema.parse(path))
    this.db
      .insert(settings)
      .values({ key: REPO_KEY, valueJson })
      .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
      .run()
  }

  // Analyses et propositions (spec 019 US2).

  /** Ouvre une analyse ; `false` si une autre est déjà en cours (FR-020, doublé par l'index partiel unique). */
  startAnalysis(row: NewAnalysis): boolean {
    return this.db.transaction((tx) => {
      const running = tx.select({ id: analyses.id }).from(analyses).where(eq(analyses.status, 'running')).get()
      if (running !== undefined) return false
      tx.insert(analyses)
        .values({ ...row, status: 'running', proposals: 0 })
        .run()
      return true
    })
  }

  /** Fin de la fenêtre de la dernière analyse réussie : la suivante repart de là (FR-012). */
  lastDoneWindowTo(): number | null {
    return (
      this.db
        .select({ to: max(analyses.windowTo) })
        .from(analyses)
        .where(eq(analyses.status, 'done'))
        .get()?.to ?? null
    )
  }

  /** Analyse réussie et ses propositions, ensemble ou pas du tout. */
  finishAnalysis(id: string, at: number, aiCallId: string | null, rows: readonly NewProposal[]): void {
    this.db.transaction((tx) => {
      for (const row of rows) {
        tx.insert(proposals)
          .values({
            id: row.id,
            analysisId: id,
            category: row.category,
            title: row.title,
            finding: row.finding,
            proposal: row.proposal,
            gain: row.gain,
            risk: row.risk,
            severity: row.severity,
            confidence: row.confidence,
            evidence: JSON.stringify(row.evidence),
            files: JSON.stringify(row.files),
            withoutEvidence: row.withoutEvidence,
            dedupeKey: row.dedupeKey,
            status: 'new',
            createdAt: at,
            updatedAt: at
          })
          .run()
      }
      tx.update(analyses)
        .set({ status: 'done', proposals: rows.length, aiCallId, finishedAt: at })
        .where(eq(analyses.id, id))
        .run()
    })
  }

  /** Analyse en échec ou annulée : rien d'autre n'est écrit, la même période reste à analyser. */
  endAnalysis(
    id: string,
    status: 'failed' | 'cancelled',
    errorCode: string,
    at: number,
    aiCallId: string | null
  ): void {
    this.db
      .update(analyses)
      .set({ status, errorCode, aiCallId, finishedAt: at })
      .where(and(eq(analyses.id, id), eq(analyses.status, 'running')))
      .run()
  }

  /** Au démarrage : une analyse restée « en cours » (app fermée) est marquée interrompue. */
  interruptRunning(at: number): number {
    return this.db
      .update(analyses)
      .set({ status: 'failed', errorCode: 'INTERRUPTED', finishedAt: at })
      .where(eq(analyses.status, 'running'))
      .run().changes
  }

  analyses(limit: number): AnalysisView[] {
    return this.db
      .select()
      .from(analyses)
      .orderBy(desc(analyses.startedAt))
      .limit(limit)
      .all()
      .map((row) => ({
        id: row.id,
        trigger: row.trigger,
        status: row.status,
        windowFrom: row.windowFrom,
        windowTo: row.windowTo,
        events: row.events,
        proposals: row.proposals,
        errorCode: row.errorCode,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt
      }))
  }

  /** Propositions de ces statuts, les plus graves puis les plus récentes d'abord. */
  proposals(statuses: readonly ProposalStatus[], limit: number): ProposalView[] {
    return this.db
      .select()
      .from(proposals)
      .where(inArray(proposals.status, [...statuses]))
      .orderBy(desc(proposals.severity), desc(proposals.createdAt))
      .limit(limit)
      .all()
      .map((row) => {
        const evidence = evidenceOf(row.evidence)
        return {
          id: row.id,
          analysisId: row.analysisId,
          category: row.category,
          title: row.title,
          finding: row.finding,
          proposal: row.proposal,
          gain: row.gain,
          risk: row.risk,
          severity: row.severity,
          confidence: row.confidence,
          evidence: {
            observations: evidence.observations.map(({ key, sentence }) => ({ key, sentence })),
            code: evidence.code.map(({ path, start, end }) => ({
              path,
              ...(start === undefined ? {} : { start }),
              ...(end === undefined ? {} : { end })
            }))
          },
          files: filesOf(row.files),
          withoutEvidence: row.withoutEvidence,
          status: (PROPOSAL_STATUSES as readonly string[]).includes(row.status) ? row.status : 'new',
          refusalReason: row.refusalReason,
          createdAt: row.createdAt
        }
      })
  }

  /** Mémoire transmise à l'analyse suivante : les dernières propositions, leur statut et la raison d'un refus. */
  memory(limit: number): MemoryItem[] {
    return this.db
      .select()
      .from(proposals)
      .orderBy(desc(proposals.updatedAt))
      .limit(limit)
      .all()
      .map((row) => ({
        category: row.category,
        title: row.title,
        status: row.status,
        refusalReason: row.refusalReason,
        files: filesOf(row.files)
      }))
  }

  /** Propositions ouvertes (doublons) et refusées (avec les faits qu'elles citaient), pour le contrôle. */
  known(): ProposalMemory[] {
    return this.db
      .select({ dedupeKey: proposals.dedupeKey, status: proposals.status, evidence: proposals.evidence })
      .from(proposals)
      .where(inArray(proposals.status, [...OPEN_STATUSES, 'refused']))
      .all()
      .map((row) => ({
        dedupeKey: row.dedupeKey,
        status: row.status,
        signatures: evidenceOf(row.evidence)
          .observations.map((item) => item.signature)
          .filter((signature) => signature !== '')
      }))
  }
}
