import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { writeChanges, type ChangeEntry } from './changeLog'
import { aiCalls } from '../schema'
import { contextAssessments, neuronMessages, neurons, settings } from '../schemaNeurons'

export type MessageRole = 'user' | 'assistant' | 'tool' | 'error'

export interface MessageRow {
  readonly id: string
  readonly role: MessageRole
  readonly text: string
  readonly createdAt: string
}

export interface ConversationNeuron {
  readonly id: string
  readonly rootId: string
  readonly kind: string
  readonly title: string
  readonly content: string | null
  readonly state: string | null
  readonly absorbed: boolean
  readonly sessionId: string | null
  readonly sessionStarted: boolean
  readonly sheetJson: string | null
  /** Dossier de projet lié ; `null` : dossier de travail de l'app. */
  readonly projectDir: string | null
}

export interface TurnRecord {
  readonly model: string
  readonly ok: boolean
  readonly durationMs: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

export interface UsageTotals {
  readonly tokens: number
  readonly turns: number
}

/** Dernier relevé de l'abonnement envoyé par le CLI (JSON validé à la lecture). */
const ACCOUNT_USAGE_KEY = 'claude_account_usage'
/** Échanges des conversations dans `ai_calls` (coût nul : l'abonnement ne se facture pas à l'appel). */
const CONVERSATION_KIND = 'conversation'

/** Nombre de messages affichés à l'ouverture (les plus récents). */
const HISTORY_LIMIT = 200

/** Conversation d'un neurone (spec 008) : session, fiche, maturité et messages affichés. */
export class ConversationRepository {
  constructor(private readonly db: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.db.transaction(() => work())
  }

  neuron(id: string): ConversationNeuron | undefined {
    const row = this.db
      .select({
        id: neurons.id,
        rootId: neurons.rootId,
        kind: neurons.kind,
        title: neurons.title,
        content: neurons.content,
        state: neurons.state,
        absorbedIn: neurons.absorbedIn,
        sessionId: neurons.sessionId,
        sessionStarted: neurons.sessionStarted,
        sheetJson: neurons.sheetJson,
        projectDir: neurons.projectDir
      })
      .from(neurons)
      .where(eq(neurons.id, id))
      .get()
    if (row === undefined) return undefined
    const { absorbedIn, ...rest } = row
    return { ...rest, absorbed: absorbedIn !== null }
  }

  setSession(id: string, sessionId: string, started: boolean): void {
    this.db.update(neurons).set({ sessionId, sessionStarted: started }).where(eq(neurons.id, id)).run()
  }

  /** Lie (ou délie) un dossier de projet ; la session repart de zéro, le CLI rangeant ses sessions par dossier. */
  setProjectDir(id: string, projectDir: string | null, newSessionId: string): void {
    this.db
      .update(neurons)
      .set({ projectDir, sessionId: newSessionId, sessionStarted: false })
      .where(eq(neurons.id, id))
      .run()
  }

  /** Échange terminé : jetons et durée, sans contenu (constitution I). */
  recordTurn(neuronId: string, turn: TurnRecord): void {
    this.db
      .insert(aiCalls)
      .values({
        id: randomUUID(),
        requestId: neuronId,
        kind: CONVERSATION_KIND,
        engine: 'claude',
        model: turn.model === '' ? 'claude-code' : turn.model,
        inputTokens: turn.inputTokens,
        outputTokens: turn.outputTokens,
        cacheReadTokens: turn.cacheReadTokens,
        cacheWriteTokens: turn.cacheWriteTokens,
        costMillicents: 0,
        status: turn.ok ? 'ok' : 'error',
        durationMs: turn.durationMs
      })
      .run()
  }

  /** Jetons traités et échanges des conversations, depuis une date (toutes, ou celles d'un neurone). */
  usageSince(sinceIso: string | null, neuronId?: string): UsageTotals {
    const conditions = [eq(aiCalls.kind, CONVERSATION_KIND)]
    if (sinceIso !== null) conditions.push(gte(aiCalls.createdAt, sinceIso))
    if (neuronId !== undefined) conditions.push(eq(aiCalls.requestId, neuronId))
    const row = this.db
      .select({
        tokens: sql<number>`coalesce(sum(${aiCalls.inputTokens} + ${aiCalls.outputTokens} + ${aiCalls.cacheReadTokens} + ${aiCalls.cacheWriteTokens}), 0)`,
        turns: sql<number>`count(*)`
      })
      .from(aiCalls)
      .where(and(...conditions))
      .get()
    return { tokens: Number(row?.tokens ?? 0), turns: Number(row?.turns ?? 0) }
  }

  saveAccountUsage(value: unknown): void {
    const valueJson = JSON.stringify(value)
    this.db
      .insert(settings)
      .values({ key: ACCOUNT_USAGE_KEY, valueJson })
      .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
      .run()
  }

  accountUsage(): unknown {
    const row = this.db
      .select({ valueJson: settings.valueJson })
      .from(settings)
      .where(eq(settings.key, ACCOUNT_USAGE_KEY))
      .get()
    if (row === undefined) return null
    try {
      return JSON.parse(row.valueJson) as unknown
    } catch {
      return null
    }
  }

  setSheet(id: string, sheetJson: string): void {
    this.db.update(neurons).set({ sheetJson }).where(eq(neurons.id, id)).run()
  }

  /** Dernière maturité évaluée d'une idée ; `null` : jamais évaluée. */
  maturity(rootId: string): string | null {
    return (
      this.db
        .select({ level: contextAssessments.level })
        .from(contextAssessments)
        .where(eq(contextAssessments.rootId, rootId))
        .orderBy(desc(sql`${contextAssessments}.rowid`))
        .get()?.level ?? null
    )
  }

  messages(neuronId: string): MessageRow[] {
    return this.db
      .select({
        id: neuronMessages.id,
        role: neuronMessages.role,
        text: neuronMessages.text,
        createdAt: neuronMessages.createdAt
      })
      .from(neuronMessages)
      .where(eq(neuronMessages.neuronId, neuronId))
      .orderBy(desc(sql`${neuronMessages}.rowid`))
      .limit(HISTORY_LIMIT)
      .all()
      .reverse()
  }

  addMessage(neuronId: string, role: MessageRole, text: string): MessageRow {
    const id = randomUUID()
    this.db.insert(neuronMessages).values({ id, neuronId, role, text }).run()
    const row = this.db
      .select({ createdAt: neuronMessages.createdAt })
      .from(neuronMessages)
      .where(and(eq(neuronMessages.id, id)))
      .get()
    return { id, role, text, createdAt: row?.createdAt ?? new Date().toISOString() }
  }

  /** Résumés des fiches des idées (affichés sous les neurones de la carte). */
  sheetSummaries(): Map<string, string> {
    const rows = this.db
      .select({ id: neurons.id, sheetJson: neurons.sheetJson })
      .from(neurons)
      .where(and(eq(neurons.kind, 'root'), sql`${neurons.sheetJson} IS NOT NULL`))
      .orderBy(asc(sql`${neurons}.rowid`))
      .all()
    const summaries = new Map<string, string>()
    for (const row of rows) {
      try {
        const resume = (JSON.parse(row.sheetJson ?? '{}') as { resume?: unknown }).resume
        if (typeof resume === 'string' && resume.trim() !== '') summaries.set(row.id, resume.trim())
      } catch {
        // Fiche abîmée : rien à afficher.
      }
    }
    return summaries
  }

  log(batchId: string, entries: readonly ChangeEntry[], actor: 'user' | 'claude'): void {
    writeChanges(this.db, batchId, entries, actor)
  }
}
