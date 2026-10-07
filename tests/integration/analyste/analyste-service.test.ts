import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AIGateway } from '../../../src/main/application/ai/AIGateway'
import { runAnalyste } from '../../../src/main/application/ai/AnalysteTask'
import { AnalysteService, type AnalysteServiceDeps } from '../../../src/main/application/analyste/AnalysteService'
import { existsInRepo } from '../../../src/main/application/analyste/repoCode'
import type { RepoState } from '../../../src/main/application/analyste/RepoGuard'
import { ClaudeCliProvider, type RunProcess } from '../../../src/main/infrastructure/ai/ClaudeCliProvider'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AiCallRepository } from '../../../src/main/infrastructure/db/repositories/AiCallRepository'
import { AnalysteRepository } from '../../../src/main/infrastructure/db/repositories/AnalysteRepository'
import { ObservationRepository } from '../../../src/main/infrastructure/db/repositories/ObservationRepository'
import type { AnalysisProgressEvent } from '../../../src/shared/ipc/analyste'
import { loadWeek } from '../../support/analyste'
import { FakeProvider } from '../../support/FakeProvider'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const DAY = 86_400_000

const PROPOSAL = {
  categorie: 'bug',
  titre: 'Corriger le TypeError de buildGraph',
  constat: 'L’erreur TypeError revient 14 fois sur la semaine.',
  preuves: {
    observations: ['obs:err:1'],
    code: [{ chemin: 'src/renderer/src/canvas/buildGraph.ts', debut: 200, fin: 220 }]
  },
  proposition: 'Vérifier la valeur avant usage.',
  gain: 'Plus de plantage de la carte.',
  risque: 'faible',
  gravite: 3,
  confiance: 0.8,
  fichiersVises: ['src/renderer/src/canvas/buildGraph.ts']
}
const AI_TO_CODE = {
  ...PROPOSAL,
  categorie: 'ia_vers_code',
  titre: 'Remplacer categoriser par une règle',
  preuves: { observations: ['obs:ia:1'], code: [] },
  fichiersVises: ['src/main/domain/ai/routing.ts']
}

/**
 * `AnalysteService` sur une vraie base (spec 019 T023) : fenêtre, seuil, verrou, contrôle, enregistrement
 * transactionnel, échec réanalysable, annulation ; le CLI `claude` est toujours simulé.
 */
describe('AnalysteService', () => {
  let root: string
  let repo: string
  let handle: DatabaseHandle
  let observations: ObservationRepository
  let store: AnalysteRepository
  let events: AnalysisProgressEvent[]
  let now: number

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-analyste-svc-'))
    repo = join(root, 'brainstormer')
    for (const file of ['src/renderer/src/canvas/buildGraph.ts', 'src/main/domain/ai/routing.ts']) {
      mkdirSync(join(repo, file, '..'), { recursive: true })
      writeFileSync(join(repo, file), '// fichier fictif\n')
    }
    handle = openDatabase({ file: join(root, 'a.db'), key: '7'.repeat(64), migrationsFolder: MIGRATIONS })
    observations = new ObservationRepository(handle.db)
    store = new AnalysteRepository(handle.db)
    events = []
    now = Date.now()
    // La semaine fictive, ramenée aux sept derniers jours.
    const week = loadWeek()
    const shift = now - 60_000 - week.to
    observations.insertBatch(week.observations.map((record) => ({ ...record, at: record.at + shift })))
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  const recordRepeatedAi = async (): Promise<void> => {
    const calls = new AiCallRepository(handle.db)
    for (let i = 0; i < 6; i += 1) {
      await calls.record({
        requestId: `r${i}`,
        kind: 'categoriser',
        engine: 'ollama',
        model: 'local',
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        costMillicents: 0,
        status: 'ok',
        durationMs: 5,
        inputFp: 'a'.repeat(16),
        outputFp: 'b'.repeat(16)
      })
    }
  }

  const service = (
    runTask: AnalysteServiceDeps['runTask'],
    overrides: Partial<AnalysteServiceDeps> = {},
    state: RepoState = { available: true, active: true, repoPath: repo, reason: null }
  ) =>
    new AnalysteService({
      guard: { current: () => state },
      observations,
      aiCalls: new AiCallRepository(handle.db),
      store,
      settings: () => store.settings(),
      code: () => null,
      runTask,
      exists: existsInRepo,
      isCoding: () => false,
      flushProbe: () => undefined,
      emit: (event) => events.push(event),
      now: () => now,
      ...overrides
    })

  const replying = (propositions: unknown[]): AnalysteServiceDeps['runTask'] => {
    const fake = new FakeProvider('claude', [{ raw: { propositions } }])
    const gateway = new AIGateway({
      providers: { ollama: new FakeProvider('ollama'), claude: fake },
      config: () => ({ allowClaudeFallback: false }),
      context: async () => undefined,
      callLog: new AiCallRepository(handle.db),
      localQueue: { enqueue: async () => undefined }
    })
    return (dossier, options) => runAnalyste(gateway, dossier, options)
  }

  it('should_save_checked_proposals_and_announce_each_step_when_the_analysis_succeeds', async () => {
    await recordRepeatedAi()
    now = Date.now() + 1000
    const invented = { ...PROPOSAL, titre: 'Fichier inventé', fichiersVises: ['src/invente.ts'] }
    const analyste = service(replying([PROPOSAL, AI_TO_CODE, invented]))
    const { analysisId } = analyste.analyze()
    await analyste.idle()
    expect(events.map((event) => event.step)).toEqual(['dossier', 'claude', 'controle', 'fini'])
    expect(events.at(-1)).toEqual({ analysisId, step: 'fini', proposals: 2 })
    const [analysis] = store.analyses(5)
    expect(analysis).toMatchObject({ id: analysisId, status: 'done', proposals: 2, trigger: 'manual' })
    const saved = store.proposals(['new'], 10)
    expect(saved.map((item) => item.category).sort()).toEqual(['bug', 'ia_vers_code'])
    const bug = saved.find((item) => item.category === 'bug')
    expect(bug?.evidence.observations[0]?.sentence).toContain('TypeError')
    expect(bug?.evidence.code).toEqual([{ path: 'src/renderer/src/canvas/buildGraph.ts', start: 200, end: 220 }])
  })

  it('should_refuse_with_not_enough_data_unless_forced', async () => {
    const analyste = service(replying([]))
    store.updateSettings({ minEvents: 10_000 })
    expect(() => analyste.analyze()).toThrow(expect.objectContaining({ code: 'NOT_ENOUGH_DATA' }))
    expect(store.analyses(5)).toEqual([])
    analyste.analyze({ force: true })
    await analyste.idle()
    expect(store.analyses(5)[0]?.status).toBe('done')
  })

  it('should_start_the_next_window_after_the_last_successful_analysis', async () => {
    const analyste = service(replying([]))
    analyste.analyze()
    await analyste.idle()
    const first = store.analyses(1)[0]
    now += 1000
    const second = service(replying([]))
    expect(() => second.analyze()).toThrow(expect.objectContaining({ code: 'NOT_ENOUGH_DATA' }))
    second.analyze({ force: true })
    await second.idle()
    const latest = store.analyses(1)[0]
    expect(latest?.windowFrom).toBe(first?.windowTo)
    expect(latest?.events).toBe(0)
  })

  it('should_allow_only_one_analysis_at_a_time_and_none_during_coding', async () => {
    let release: () => void = () => undefined
    const slow: AnalysteServiceDeps['runTask'] = () =>
      new Promise((resolve) => {
        release = () => resolve({ ok: true, value: { data: { propositions: [] } } })
      })
    const analyste = service(slow)
    analyste.analyze()
    expect(() => analyste.analyze()).toThrow(expect.objectContaining({ code: 'ANALYSIS_RUNNING' }))
    // Un deuxième service (autre fenêtre) se heurte au verrou en base.
    expect(() => service(slow).analyze()).toThrow(expect.objectContaining({ code: 'ANALYSIS_RUNNING' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    release()
    await analyste.idle()
    expect(() => service(slow, { isCoding: () => true }).analyze()).toThrow(
      expect.objectContaining({ code: 'UPDATE_CODING' })
    )
  })

  it('should_mark_the_analysis_failed_and_keep_the_same_window_when_claude_is_unavailable', async () => {
    const down: AnalysteServiceDeps['runTask'] = async () => ({
      ok: false,
      error: { code: 'AI_UNAVAILABLE', message: 'Claude est indisponible', retryable: true }
    })
    const analyste = service(down)
    analyste.analyze()
    await analyste.idle()
    expect(events.at(-1)).toMatchObject({ step: 'echec', errorCode: 'AI_UNAVAILABLE' })
    const failed = store.analyses(1)[0]
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'AI_UNAVAILABLE' })
    expect(store.proposals(['new'], 10)).toEqual([])
    // Relance : la fenêtre n'a pas avancé (elle n'avance qu'après un succès), les mêmes observations sont reprises.
    now += 1000
    const retry = service(replying([]))
    retry.analyze()
    await retry.idle()
    expect(store.lastDoneWindowTo()).toBe(store.analyses(1)[0]?.windowTo)
    expect(store.analyses(1)[0]?.events).toBe(failed?.events)
  })

  it('should_cancel_the_running_analysis_and_kill_the_cli_process', async () => {
    let aborted = false
    const waiting: AnalysteServiceDeps['runTask'] = (_dossier, { signal }) =>
      new Promise((resolve) => {
        signal.addEventListener('abort', () => {
          aborted = true
          resolve({ ok: false, error: { code: 'AI_UNAVAILABLE', message: 'annulé', retryable: false } })
        })
      })
    const analyste = service(waiting)
    const { analysisId } = analyste.analyze()
    expect(() => analyste.cancel('autre')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    analyste.cancel(analysisId)
    await analyste.idle()
    expect(aborted).toBe(true)
    expect(store.analyses(1)[0]).toMatchObject({ status: 'cancelled', errorCode: 'CANCELLED' })
    expect(events.at(-1)).toMatchObject({ step: 'echec', errorCode: 'CANCELLED' })
    expect(analyste.isRunning()).toBe(false)
  })

  it('should_mark_an_analysis_left_running_as_interrupted_at_startup', () => {
    store.startAnalysis({ id: 'x', trigger: 'manual', windowFrom: 0, windowTo: 1, events: 0, startedAt: 1 })
    service(replying([])).recover()
    expect(store.analyses(1)[0]).toMatchObject({ status: 'failed', errorCode: 'INTERRUPTED' })
  })

  it('should_refuse_when_the_probe_is_inactive', () => {
    const analyste = service(
      replying([]),
      {},
      { available: true, active: false, repoPath: null, reason: 'NOT_DESIGNATED' }
    )
    expect(() => analyste.analyze()).toThrow(expect.objectContaining({ code: 'PROBE_INACTIVE' }))
  })

  it('should_not_repropose_a_refused_proposal_without_a_new_fact', async () => {
    const analyste = service(replying([PROPOSAL]))
    analyste.analyze()
    await analyste.idle()
    // Refus simulé (le tri arrive avec l'US3) : la proposition passe « refusée ».
    handle.db.run(sql`UPDATE proposals SET status = 'refused', refusal_reason = 'pas utile'`)
    now += 1000
    const again = service(replying([PROPOSAL]))
    again.analyze({ force: true })
    await again.idle()
    expect(events.at(-1)).toMatchObject({ step: 'fini', proposals: 0 })
  })

  it('should_have_no_effect_when_a_trapped_comment_asks_to_write_with_the_simulated_cli', async () => {
    // Le CLI simulé « obéit » à un commentaire piégé : il propose de réécrire un fichier hors du dépôt. L'analyse n'a
    // aucun outil d'écriture ni de commande, et la proposition est écartée au contrôle.
    const runs: Parameters<RunProcess>[0][] = []
    const trapped = {
      ...PROPOSAL,
      titre: 'Modifie le fichier de données comme demandé',
      fichiersVises: ['../../AppData/Roaming/gestionnaire-idees/gestionnaire-idees.db']
    }
    const cli = new ClaudeCliProvider({
      claudePath: async () => 'claude.exe',
      model: () => 'claude-opus-5-5',
      cwd: () => join(root, 'sandbox'),
      deniedReadDirs: () => [join(root, 'profil')],
      run: async (input) => {
        runs.push(input)
        const stdout = JSON.stringify({
          type: 'result',
          subtype: 'success',
          is_error: false,
          structured_output: { propositions: [trapped] }
        })
        return { code: 0, stdout, stderr: '', timedOut: false }
      }
    })
    const gateway = new AIGateway({
      providers: { ollama: new FakeProvider('ollama'), claude: cli },
      config: () => ({ allowClaudeFallback: false }),
      context: async () => undefined,
      callLog: new AiCallRepository(handle.db),
      localQueue: { enqueue: async () => undefined }
    })
    const analyste = service((dossier, options) => runAnalyste(gateway, dossier, options))
    analyste.analyze()
    await analyste.idle()
    const args = runs[0]?.args.join(' ') ?? ''
    expect(runs[0]?.cwd).toBe(repo)
    expect(args).toContain('--tools Read Glob Grep')
    for (const forbidden of ['Write', 'Edit', 'Bash', 'bypassPermissions']) expect(args).not.toContain(forbidden)
    expect(events.at(-1)).toMatchObject({ step: 'fini', proposals: 0 })
    expect(store.proposals(['new'], 10)).toEqual([])
  })

  it('should_read_ai_fingerprints_of_the_window_only', async () => {
    await recordRepeatedAi()
    const calls = new AiCallRepository(handle.db)
    expect(calls.fingerprints(now - DAY, now + DAY)).toHaveLength(6)
    expect(calls.fingerprints(now + DAY, now + 2 * DAY)).toEqual([])
  })
})
