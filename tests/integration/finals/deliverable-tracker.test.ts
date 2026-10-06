import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliverableTracker } from '../../../src/main/application/finals/DeliverableTracker'
import { ExecutionService } from '../../../src/main/application/finals/ExecutionService'
import { FinalService } from '../../../src/main/application/finals/FinalService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { FinalRepository } from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { ProjectFiles } from '../../../src/main/infrastructure/finals/ProjectFiles'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('livrable reconstitué par le hook avant écriture (spec 014 R5, FR-010)', () => {
  let t: NeuronHarness
  let root: string
  let project: string
  let repository: FinalRepository
  let finals: FinalService
  let executions: ExecutionService
  let history: HistoryService
  let tracker: DeliverableTracker
  let clock: number
  let step: string
  let other: string
  let busy: boolean

  beforeEach(async () => {
    t = createNeuronHarness()
    root = mkdtempSync(join(tmpdir(), 'gi-hook-'))
    project = join(root, 'site')
    mkdirSync(project)
    mkdirSync(join(root, 'profil'))
    writeFileSync(join(project, 'README.md'), '# Site\n')
    repository = new FinalRepository(t.handle.db)
    const plan = new PlanRepository(t.handle.db)
    finals = new FinalService({ repository, plan })
    busy = false
    const files = new ProjectFiles({ profileDir: join(root, 'profil') })
    executions = new ExecutionService({
      repository,
      plan,
      projectDir: () => project,
      documents: () => [],
      files,
      conversations: {
        send: vi.fn(async () => {
          busy = true
        }),
        stop: vi.fn(),
        isBusy: () => busy
      },
      emit: () => undefined
    })
    history = new HistoryService(new HistoryRepository(t.handle.db), executions.historyHandlers())
    clock = 0
    tracker = new DeliverableTracker({
      finals: repository,
      projectDir: () => project,
      files,
      record: (neuronId, relative, before, next) => executions.recordWrite(neuronId, relative, before, next),
      now: () => clock
    })
    const genesis = (await t.neurons.create({ text: 'Site vitrine' })).id
    const service = new PlanService({ repository: plan, finals })
    const { proposalId } = service.propose({
      parentId: genesis,
      steps: [
        { key: 'contact', title: 'Page contact', why: 'x' },
        { key: 'autre', title: 'Autre étape', why: 'y' }
      ]
    })
    ;[step = '', other = ''] = service.decide({
      proposalId,
      accept: plan.proposal(proposalId)?.items.map((item) => item.id) ?? [],
      reject: []
    }).born
    finals.propose({ neuronId: step, deliverable: 'Page contact', reason: 'Prête', origin: 'claude' })
    finals.decide(step, true)
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  /** Ce que fait Claude Code : hook, écriture sur le disque, puis résultat de l'outil. */
  const write = (neuronId: string, id: string, relative: string, content: string, ok = true): void => {
    tracker.before(neuronId, { tool: 'Write', file_path: join(project, relative), tool_use_id: id })
    if (ok) {
      mkdirSync(join(project, relative, '..'), { recursive: true })
      writeFileSync(join(project, relative), content)
    }
    tracker.after(neuronId, id, ok)
  }

  it('should_add_created_and_modified_files_to_the_deliverable_keeping_the_first_before', () => {
    write(step, 't1', 'src/Contact.tsx', 'export const A = 1\n')
    write(step, 't2', 'README.md', '# Site\nContact\n')
    write(step, 't3', 'README.md', '# Site\nContact et plan\n')
    expect(repository.files(step).map((file) => [file.path, file.beforeContent, file.afterContent])).toEqual([
      ['src/Contact.tsx', null, 'export const A = 1\n'],
      ['README.md', '# Site\n', '# Site\nContact et plan\n']
    ])
    expect(history.list().items[0]?.summary).toBe('Claude : fichier « README.md » modifié')
    expect(tracker.pendingCount()).toBe(0)
  })

  it('should_trace_the_write_in_the_running_execution', async () => {
    await executions.execute(step)
    write(step, 't1', 'src/Contact.tsx', 'x\n')
    const [execution] = repository.executionsOf(step)
    expect(repository.eventsOf(execution?.id ?? '').map((event) => [event.kind, event.path])).toContainEqual([
      'ecriture',
      'src/Contact.tsx'
    ])
    expect(execution?.filesWritten).toBe(1)
  })

  it('should_ignore_conversations_without_an_accepted_final_action', () => {
    write(other, 't1', 'a.md', 'x')
    finals.propose({ neuronId: other, deliverable: 'x', reason: 'y', origin: 'claude' })
    write(other, 't2', 'b.md', 'x')
    expect(repository.files(other)).toEqual([])
  })

  it.each([
    ['outside_the_project', (): string => join(root, 'hors.txt')],
    ['to_a_secret_file', (): string => join(project, '.env')],
    ['with_a_relative_path', (): string => 'README.md']
  ])('should_not_track_a_write_%s', (_label, path) => {
    expect(tracker.before(step, { tool: 'Write', file_path: path(), tool_use_id: 't1' })).toEqual({ text: 'ignoré' })
    expect(tracker.pendingCount()).toBe(0)
  })

  it('should_drop_a_refused_write_and_ignore_a_result_from_another_conversation', () => {
    write(step, 't1', 'a.md', 'x', false)
    tracker.before(step, { tool: 'Write', file_path: join(project, 'b.md'), tool_use_id: 't2' })
    writeFileSync(join(project, 'b.md'), 'y')
    tracker.after(other, 't2', true)
    expect(repository.files(step)).toEqual([])
    expect(tracker.pendingCount()).toBe(1)
  })

  it('should_forget_an_announced_write_without_result_after_thirty_minutes', () => {
    tracker.before(step, { tool: 'Write', file_path: join(project, 'a.md'), tool_use_id: 't1' })
    clock = 31 * 60_000
    tracker.before(step, { tool: 'Write', file_path: join(project, 'b.md'), tool_use_id: 't2' })
    expect(tracker.pendingCount()).toBe(1)
  })

  it('should_not_add_a_file_left_unchanged', () => {
    write(step, 't1', 'README.md', '# Site\n')
    expect(repository.files(step)).toEqual([])
  })
})
