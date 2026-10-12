import { cpSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadEngine, type Engine } from '../../../src/analysis-worker/engine'
import { processBatch } from '../../../src/analysis-worker/process'
import type { ResolutionItem } from '../../../src/main/application/ai/RepriseResolutionTask'
import { AnalysisService } from '../../../src/main/application/reprise/AnalysisService'
import {
  ResolutionService,
  type ResolutionDeps,
  type ResolutionSummary
} from '../../../src/main/application/reprise/ResolutionService'
import { CodeGraphRepository } from '../../../src/main/infrastructure/db/repositories/CodeGraphRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { codeRuns } from '../../../src/main/infrastructure/db/schemaReprise'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { readProjectText } from '../../../src/main/infrastructure/reprise/projectText'
import type { ResolutionOut } from '../../../src/shared/ai/schemas'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { GRAMMARS_DIR, REPRISE_FIXTURES } from '../../support/reprise'

type Reply = ResolutionDeps['runResolution']

const answer = (items: ResolutionOut['items'], engine: 'claude' | 'ollama' = 'claude') => ({
  ok: true as const,
  value: { data: { items }, engine, model: engine === 'claude' ? 'claude-opus-5-5' : 'qwen-local' }
})

describe('levée des ambiguïtés par l’IA (spec 017 US6, T032)', () => {
  let engine: Engine
  let t: NeuronHarness
  let root: string
  let reprise: RepriseRepository
  let graph: CodeGraphRepository
  let sent: { items: readonly ResolutionItem[]; localOnly: boolean }[]
  let reply: Reply
  let events: unknown[]

  beforeAll(async () => {
    engine = await loadEngine(GRAMMARS_DIR)
  })
  beforeEach(() => {
    t = createNeuronHarness()
    reprise = new RepriseRepository(t.handle.db)
    graph = new CodeGraphRepository(t.handle.db)
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-resolve-')))
    sent = []
    events = []
    reply = async () => answer([])
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  async function analyzed(
    fixture: string,
    confidentiality: 'claude' | 'local'
  ): Promise<{ genesis: string; dir: string; resolution: ResolutionService }> {
    const dir = join(root, fixture)
    cpSync(join(REPRISE_FIXTURES, fixture), dir, { recursive: true })
    const genesis = (await t.neurons.create({ text: fixture })).id
    reprise.createProject({
      genesisId: genesis,
      rootDir: dir,
      source: 'folder',
      remoteUrl: null,
      confidentiality,
      confidentialityChangedAt: '2026-10-12T08:00:00.000Z'
    })
    const analysis = new AnalysisService({
      reprise,
      graph,
      scan: (folder) => scanProject(folder),
      runWorker: (request, onMessage) => {
        void processBatch(engine, request, (message) => onMessage(JSON.parse(JSON.stringify(message))))
        return { cancel: () => undefined }
      },
      emit: () => undefined
    })
    analysis.analyze(genesis)
    await analysis.idle()
    const resolution = new ResolutionService({
      reprise,
      graph,
      claudeAllowed: (id) => reprise.project(id)?.confidentiality === 'claude',
      runResolution: (items, options) => {
        sent.push({ items, localOnly: options.localOnly })
        return reply(items, options)
      },
      readText: readProjectText,
      emit: (event) => events.push(event)
    })
    return { genesis, dir, resolution }
  }

  const ambiguous = (genesis: string) => graph.edges(genesis).find((edge) => edge.rawTarget === 'store.Save')
  const symbolNamed = (genesis: string, name: string, owner: string) =>
    graph.symbols(genesis).find((symbol) => symbol.name === name && symbol.qualifiedName.includes(owner))

  it('should_keep_the_possible_targets_of_an_uncertain_link_and_none_for_a_sure_one', async () => {
    const { genesis } = await analyzed('cs-app', 'claude')
    const edge = ambiguous(genesis)
    const candidates = JSON.parse(edge?.candidatesJson ?? '[]') as string[]
    expect(candidates).toContain(symbolNamed(genesis, 'Save', 'InvoiceRepository')?.id)
    expect(candidates.length).toBeGreaterThanOrEqual(3)
    expect(graph.edges(genesis).filter((entry) => entry.provenance === 'syntax')).not.toHaveLength(0)
    expect(
      graph.edges(genesis).filter((entry) => entry.provenance === 'syntax' && entry.candidatesJson !== null)
    ).toHaveLength(0)
    expect(graph.resolvableEdges(genesis)).toBeGreaterThanOrEqual(1)
  })

  it('should_turn_the_ambiguous_save_into_a_deduced_link_to_the_right_class_with_its_reason', async () => {
    const { genesis, resolution } = await analyzed('cs-app', 'claude')
    const target = symbolNamed(genesis, 'Save', 'InvoiceRepository')
    const before = graph.resolvableEdges(genesis)
    reply = async (items) =>
      answer(
        items.map((item) => ({
          edgeId: item.edgeId,
          targetId: item.call === 'store.Save' ? (target?.id ?? null) : null,
          reason: 'Archive appelle un magasin de factures.'
        }))
      )

    const summary: ResolutionSummary = await resolution.resolve(genesis)

    expect(summary).toMatchObject({ deduced: 1, stopped: false, remaining: 0 })
    expect(ambiguous(genesis)).toMatchObject({
      toSymbolId: target?.id,
      provenance: 'deduced',
      reason: 'Archive appelle un magasin de factures.'
    })
    expect(graph.resolvableEdges(genesis)).toBeLessThan(before)
    expect(sent[0]).toMatchObject({ localOnly: false })
    const item = sent[0]?.items.find((entry) => entry.call === 'store.Save')
    expect(item?.context.length).toBeLessThanOrEqual(8)
    expect(item?.context).toContain('        store.Save(due);')
    expect(item?.candidates.map((candidate) => candidate.id)).toContain(target?.id)
    expect(JSON.stringify(sent)).not.toContain(root)
    const run = t.handle.db.select().from(codeRuns).where(eq(codeRuns.kind, 'resolution')).get()
    expect(run).toMatchObject({ state: 'done' })
    expect(JSON.parse(run?.statsJson ?? '{}')).toMatchObject({ deduced: 1, batches: 1, local: 0 })
    expect(run?.statsJson).not.toMatch(/Save|Orders|cs-app/)
    expect(events).toContainEqual({ type: 'reprise:changed', payload: { genesisId: genesis } })
  })

  it('should_reject_a_target_outside_the_candidates_and_leave_the_link_uncertain', async () => {
    const { genesis, resolution } = await analyzed('cs-app', 'claude')
    const outside = symbolNamed(genesis, 'Place', 'OrderService')
    const before = ambiguous(genesis)
    expect(JSON.parse(before?.candidatesJson ?? '[]')).not.toContain(outside?.id)
    reply = async (items) =>
      answer([
        ...items.map((item) => ({ edgeId: item.edgeId, targetId: outside?.id ?? null, reason: 'Hors candidats.' })),
        { edgeId: 'e'.repeat(32), targetId: null, reason: 'Lien inventé.' }
      ])

    const summary = await resolution.resolve(genesis)

    expect(summary.deduced).toBe(0)
    expect(ambiguous(genesis)).toMatchObject({
      toSymbolId: before?.toSymbolId,
      provenance: 'uncertain',
      reason: before?.reason,
      candidatesJson: before?.candidatesJson
    })
    const run = t.handle.db.select().from(codeRuns).where(eq(codeRuns.kind, 'resolution')).get()
    expect(JSON.parse(run?.statsJson ?? '{}').rejected).toBeGreaterThanOrEqual(2)
  })

  it('should_keep_a_link_uncertain_with_the_reason_when_the_model_cannot_decide_and_not_ask_again', async () => {
    const { genesis, resolution } = await analyzed('cs-app', 'claude')
    reply = async (items) =>
      answer(items.map((item) => ({ edgeId: item.edgeId, targetId: null, reason: 'Le type du magasin est inconnu.' })))

    const first = await resolution.resolve(genesis)

    expect(first.deduced).toBe(0)
    expect(first.undecided).toBeGreaterThanOrEqual(1)
    expect(ambiguous(genesis)).toMatchObject({
      toSymbolId: null,
      provenance: 'uncertain',
      reason: 'Le type du magasin est inconnu.',
      candidatesJson: null
    })
    const calls = sent.length
    await resolution.resolve(genesis)
    expect(sent).toHaveLength(calls)
  })

  it('should_never_send_a_local_only_project_to_claude_and_say_so_when_the_local_model_is_down', async () => {
    const { genesis, resolution } = await analyzed('cs-app', 'local')
    reply = async () => ({ ok: false, error: { code: 'AI_UNAVAILABLE', message: 'x', retryable: true } })

    await expect(resolution.resolve(genesis)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      message: expect.stringMatching(/jamais vers Claude/)
    })

    expect(sent[0]?.localOnly).toBe(true)
    expect(ambiguous(genesis)).toMatchObject({ provenance: 'uncertain' })
    expect(t.handle.db.select().from(codeRuns).where(eq(codeRuns.kind, 'resolution')).get()).toMatchObject({
      state: 'failed'
    })
    expect(resolution.isRunning(genesis)).toBe(false)
  })

  it('should_resolve_with_the_local_model_for_a_local_only_project', async () => {
    const { genesis, resolution } = await analyzed('cs-app', 'local')
    const target = symbolNamed(genesis, 'Save', 'SqlOrderRepository')
    reply = async (items) =>
      answer(
        items.map((item) => ({ edgeId: item.edgeId, targetId: target?.id ?? null, reason: 'Magasin de commandes.' })),
        'ollama'
      )
    await resolution.resolve(genesis)
    expect(sent[0]?.localOnly).toBe(true)
    expect(ambiguous(genesis)).toMatchObject({ toSymbolId: target?.id, provenance: 'deduced' })
  })

  it('should_not_read_a_sensitive_file_for_the_context', async () => {
    const { genesis, resolution } = await analyzed('hostile-app', 'claude')
    await resolution.resolve(genesis)
    expect(JSON.stringify(sent)).not.toMatch(/appsettings|\.env|SECRET/i)
  })

  it('should_refuse_a_project_never_analyzed_or_a_second_pass_at_the_same_time', async () => {
    const { genesis, resolution } = await analyzed('cs-app', 'claude')
    let release: () => void = () => undefined
    reply = () =>
      new Promise((resolve) => {
        release = () => resolve(answer([]))
      })
    const pending = resolution.resolve(genesis)
    await expect(resolution.resolve(genesis)).rejects.toMatchObject({ code: 'BUSY' })
    expect(resolution.isRunning(genesis)).toBe(true)
    release()
    await pending

    const fresh = (await t.neurons.create({ text: 'neuf' })).id
    reprise.createProject({
      genesisId: fresh,
      rootDir: join(root, 'neuf'),
      source: 'folder',
      remoteUrl: null,
      confidentiality: 'claude',
      confidentialityChangedAt: '2026-10-12T08:00:00.000Z'
    })
    await expect(resolution.resolve(fresh)).rejects.toMatchObject({ code: 'NOT_ANALYZED' })
    await expect(resolution.resolve('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })
})

describe('levée des ambiguïtés — lots et arrêt de l’IA (spec 017 US6, T032)', () => {
  const GENESIS = 'g1'
  const symbol = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    fileId: 'f',
    parentId: null,
    kind: 'method',
    name: 'Save',
    qualifiedName: `Shop.${id}.Save`,
    startLine: 1,
    endLine: 3,
    complexity: 1,
    category: 'domain',
    categorySource: 'rules',
    categoryReason: null,
    path: 'a.cs',
    ...extra
  })
  const targets = [symbol('t1'), symbol('t2')]
  const caller = symbol('c', { name: 'Run', qualifiedName: 'Shop.Run' })
  const edges = Array.from({ length: 120 }, (_, index) => ({
    id: `edge${String(index).padStart(3, '0')}`,
    genesisId: GENESIS,
    fromSymbolId: 'c',
    toSymbolId: null,
    rawTarget: `x${index}.Save`,
    kind: 'call',
    provenance: 'uncertain',
    reason: '2 cibles possibles',
    count: 1,
    candidatesJson: JSON.stringify(['t1', 't2'])
  }))

  function build(replyFor: (call: number, items: readonly ResolutionItem[]) => ReturnType<Reply>) {
    const updated: { id: string; patch: Record<string, unknown> }[] = []
    let call = 0
    const runs: { state: string; stats?: Record<string, number> }[] = []
    const service = new ResolutionService({
      reprise: {
        project: () => ({ analyzedAt: '2026-10-12T08:00:00.000Z', rootDir: '/inexistant' }),
        startRun: () => undefined,
        endRun: (_id: string, state: string, _at: string, stats?: Record<string, number>) => {
          runs.push({ state, ...(stats === undefined ? {} : { stats }) })
        }
      } as unknown as ResolutionDeps['reprise'],
      graph: {
        edges: () => edges,
        symbols: () => [...targets, caller],
        updateEdge: (_g: string, id: string, patch: Record<string, unknown>) => {
          updated.push({ id, patch })
          return true
        }
      } as unknown as ResolutionDeps['graph'],
      claudeAllowed: () => true,
      runResolution: (items) => replyFor(call++, items),
      readText: () => null,
      emit: () => undefined
    })
    return { service, updated, runs, calls: () => call }
  }

  it('should_send_the_links_by_batches_of_fifty_and_keep_the_batch_of_each_answer', async () => {
    const { service, updated, calls } = build(async (_call, items) =>
      answer(items.map((item) => ({ edgeId: item.edgeId, targetId: 't1', reason: 'Indice du nom.' })))
    )
    const summary = await service.resolve(GENESIS)
    expect(calls()).toBe(3)
    expect(summary).toMatchObject({ deduced: 120, remaining: 0, stopped: false })
    expect(updated).toHaveLength(120)
    expect(updated[0]?.patch).toMatchObject({ toSymbolId: 't1', provenance: 'deduced', reason: 'Indice du nom.' })
  })

  it('should_stop_when_the_ai_runs_out_keep_what_was_done_and_leave_the_rest_uncertain', async () => {
    const { service, updated, runs, calls } = build(async (call, items) =>
      call === 0
        ? answer(items.map((item) => ({ edgeId: item.edgeId, targetId: 't2', reason: 'Premier lot.' })))
        : { ok: false, error: { code: 'AI_UNAVAILABLE', message: 'Abonnement épuisé', retryable: true } }
    )
    const summary = await service.resolve(GENESIS)
    expect(calls()).toBe(2)
    expect(summary).toMatchObject({ deduced: 50, remaining: 70, stopped: true })
    expect(updated).toHaveLength(50)
    expect(runs.at(-1)).toMatchObject({ state: 'done', stats: { stopped: 1, remaining: 70, deduced: 50 } })
  })

  it('should_fail_with_the_provider_message_when_the_first_batch_is_refused', async () => {
    const { service, updated, runs } = build(async () => ({
      ok: false,
      error: { code: 'AI_INVALID_OUTPUT', message: 'Sortie invalide', retryable: false }
    }))
    await expect(service.resolve(GENESIS)).rejects.toMatchObject({ code: 'AI_FAILED', message: 'Sortie invalide' })
    expect(updated).toHaveLength(0)
    expect(runs.at(-1)?.state).toBe('failed')
  })

  it('should_ignore_a_duplicated_answer_for_the_same_link', async () => {
    const { service, updated } = build(async (_call, items) =>
      answer([
        { edgeId: items[0]?.edgeId ?? '', targetId: 't1', reason: 'Première.' },
        { edgeId: items[0]?.edgeId ?? '', targetId: 't2', reason: 'Doublon.' }
      ])
    )
    await service.resolve(GENESIS)
    expect(updated.filter((entry) => entry.id === 'edge000')).toHaveLength(1)
    expect(updated[0]?.patch).toMatchObject({ toSymbolId: 't1' })
  })
})
