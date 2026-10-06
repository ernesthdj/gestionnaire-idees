import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ExecutionService } from '../../../src/main/application/finals/ExecutionService'
import { FinalService } from '../../../src/main/application/finals/FinalService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { EXECUTE_MESSAGE } from '../../../src/main/domain/finals/executionBrief'
import { FinalRepository } from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { ProjectFiles } from '../../../src/main/infrastructure/finals/ProjectFiles'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('exécuter une action finale (spec 013 US2)', () => {
  let t: NeuronHarness
  let root: string
  let project: string
  let linked: string | null
  let repository: FinalRepository
  let plan: PlanRepository
  let finals: FinalService
  let executions: ExecutionService
  let history: HistoryService
  let busy: boolean
  let send: Mock<(neuronId: string, text: string, data?: string) => Promise<void>>
  let stop: Mock<(neuronId: string) => void>
  let changed: string[]
  let budget: string
  let contact: string

  beforeEach(async () => {
    t = createNeuronHarness()
    root = mkdtempSync(join(tmpdir(), 'gi-exec-'))
    project = join(root, 'site')
    mkdirSync(project)
    mkdirSync(join(root, 'profil'))
    writeFileSync(join(project, 'README.md'), '# Site\n\nAccueil.\n')
    linked = project
    repository = new FinalRepository(t.handle.db)
    plan = new PlanRepository(t.handle.db)
    finals = new FinalService({ repository, plan })
    busy = false
    send = vi.fn(async () => {
      busy = true
    })
    stop = vi.fn()
    changed = []
    executions = new ExecutionService({
      repository,
      plan,
      projectDir: () => linked,
      documents: () => [{ id: 'd1', title: 'Charte', fileLabel: 'docs/brainstormer/charte.md' }],
      files: new ProjectFiles({ profileDir: join(root, 'profil') }),
      conversations: { send, stop, isBusy: () => busy },
      emit: (neuronId) => changed.push(neuronId)
    })
    history = new HistoryService(new HistoryRepository(t.handle.db), {
      ...finals.historyHandlers(),
      ...executions.historyHandlers()
    })
    const genesis = (await t.neurons.create({ text: 'Site vitrine' })).id
    const service = new PlanService({ repository: plan, finals })
    const { proposalId } = service.propose({
      parentId: genesis,
      steps: [
        { key: 'budget', title: 'Valider le budget', why: 'x' },
        { key: 'contact', title: 'Page contact', why: 'y', waitsFor: ['budget'] }
      ]
    })
    ;[budget = '', contact = ''] = service.decide({
      proposalId,
      accept: plan.proposal(proposalId)?.items.map((item) => item.id) ?? [],
      reject: []
    }).born
    for (const id of [budget, contact]) {
      finals.propose({ neuronId: id, deliverable: `Livrable de ${id}`, reason: 'Prête', origin: 'claude' })
      finals.decide(id, true)
    }
    plan.setStatus(budget, 'fait')
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  /** Fin du tour de Claude, comme la conversation l'annonce. */
  const turnEnd = (neuronId = contact, interrupted = false): void => {
    busy = false
    executions.onChatEvent({ type: 'chat:turnEnd', payload: { neuronId, message: null, interrupted } })
  }

  /** Écriture de Claude Code (outil natif) signalée par le hook avant écriture (spec 014 R5). */
  const claudeWrites = (relative: string, content: string, neuronId = contact): void => {
    const target = join(project, ...relative.split('/'))
    const before = existsSync(target) ? readFileSync(target, 'utf8') : null
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, content)
    executions.recordWrite(neuronId, relative, before, content)
  }

  it('should_send_the_execute_message_with_the_execution_brief_and_mark_the_action_running', async () => {
    await executions.execute(contact)
    const [neuronId, text, brief] = send.mock.calls[0] as [string, string, string]
    expect([neuronId, text]).toEqual([contact, EXECUTE_MESSAGE])
    expect(brief).toContain('<dossier_execution>')
    expect(brief).toContain(`Livrable de ${contact}`)
    expect(brief).toContain('① « Valider le budget » — fait')
    expect(brief).toContain('« Charte » [d1]')
    expect(brief).toContain('Dossier de projet lié : « site »')
    // Spec 014 : outils natifs de Claude, selon le mode ; plus d'outils maison ni de scripts approuvés.
    expect(brief).toContain('écris avec tes outils (Write, Edit)')
    expect(brief).toContain('Cette étape EST l’action finale')
    expect(`${brief}${EXECUTE_MESSAGE}`).not.toMatch(/fichier_ecrire|fichier_modifier|commande_lancer/)
    expect(finals.actionOf(contact)?.state).toBe('en_cours')
    expect(changed).toContain(contact)
  })

  it('should_warn_about_prerequisites_not_done_unless_forced', async () => {
    plan.setStatus(budget, 'a_faire')
    await expect(executions.execute(contact)).rejects.toMatchObject({
      code: 'PREREQUISITES',
      details: { pending: ['Valider le budget'] }
    })
    expect(send).not.toHaveBeenCalled()
    await executions.execute(contact, { force: true })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('should_run_one_execution_at_a_time_per_genesis_and_refuse_a_proposal', async () => {
    await executions.execute(contact)
    busy = false
    await expect(executions.execute(budget)).rejects.toMatchObject({ code: 'BUSY' })
    await expect(executions.execute(contact)).rejects.toMatchObject({ code: 'BUSY' })
    finals.demote(budget)
    finals.propose({ neuronId: budget, deliverable: 'x', reason: 'y', origin: 'claude' })
    await expect(executions.execute(budget)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('should_build_the_deliverable_from_the_writes_of_claude_during_and_after_the_execution', async () => {
    await executions.execute(contact)
    claudeWrites('src/pages/Contact.tsx', 'export const Contact = 1\n')
    claudeWrites('README.md', '# Site\n\nAccueil et contact.\n')
    claudeWrites('README.md', '# Site\n\nAccueil, contact et plan.\n')
    expect(repository.files(contact).map((file) => [file.path, file.beforeContent])).toEqual([
      ['src/pages/Contact.tsx', null],
      ['README.md', '# Site\n\nAccueil.\n']
    ])
    turnEnd()
    expect(finals.actionOf(contact)?.state).toBe('a_revoir')
    expect(repository.executionsOf(contact)[0]).toMatchObject({ outcome: 'terminee', filesWritten: 2 })
    // Après l'exécution, une correction demandée dans le chat rejoint aussi le livrable (spec 014 D6).
    claudeWrites('src/pages/Plan.tsx', 'export const Plan = 1\n')
    expect(repository.files(contact).map((file) => file.path)).toContain('src/pages/Plan.tsx')
  })

  it('should_trace_reads_once_and_leave_writes_to_the_hook', async () => {
    await executions.execute(contact)
    const tool = (text: string, toolStatus: 'running' | 'ok') => ({
      type: 'chat:tool' as const,
      payload: { neuronId: contact, message: { id: 't', role: 'tool' as const, text, createdAt: 'x', toolStatus } }
    })
    executions.onChatEvent(tool('fichier lu : README.md', 'running'))
    executions.onChatEvent(tool('fichier lu : README.md', 'ok'))
    executions.onChatEvent(tool('fichier modifié : README.md', 'running'))
    executions.onChatEvent(tool('commande : npm test', 'running'))
    const [execution] = repository.executionsOf(contact)
    expect(repository.eventsOf(execution?.id ?? '').map((event) => [event.kind, event.detail])).toEqual([
      ['lecture', 'fichier lu : README.md'],
      ['message', 'commande : npm test']
    ])
  })

  it('should_produce_documents_only_without_a_linked_folder', async () => {
    linked = null
    await executions.execute(contact)
    expect(send.mock.calls[0]?.[2]).toContain('Aucun dossier de projet lié')
  })

  it('should_undo_a_write_from_the_history_into_the_trash_and_restore_a_modified_file', async () => {
    await executions.execute(contact)
    claudeWrites('nouveau.md', '# N')
    claudeWrites('README.md', '# Site\n\nBienvenue.\n')
    const [modified, created] = history.list().items
    expect([modified?.summary, created?.summary]).toEqual([
      'Claude : fichier « README.md » modifié',
      'Claude : fichier « nouveau.md » créé'
    ])
    history.undo(modified?.batchId ?? '')
    expect(readFileSync(join(project, 'README.md'), 'utf8')).toBe('# Site\n\nAccueil.\n')
    history.undo(created?.batchId ?? '')
    expect(existsSync(join(project, 'nouveau.md'))).toBe(false)
    expect(readdirSync(join(root, 'profil', 'documents', '.corbeille'))).toHaveLength(1)
  })

  it('should_refuse_to_undo_a_write_when_the_file_was_changed_by_hand_since', async () => {
    await executions.execute(contact)
    claudeWrites('a.md', 'v1')
    writeFileSync(join(project, 'a.md'), 'retouché')
    expect(() => history.undo(history.list().items[0]?.batchId ?? '')).toThrow(
      expect.objectContaining({ code: 'UNDO_CONFLICT' })
    )
  })

  it('should_stop_an_execution_through_the_conversation_or_directly_when_it_is_idle', async () => {
    await executions.execute(contact)
    executions.stop(contact)
    expect(stop).toHaveBeenCalledWith(contact)
    turnEnd(contact, true)
    expect(repository.executionsOf(contact)[0]?.outcome).toBe('arretee')
    expect(finals.actionOf(contact)?.state).toBe('prete')
    await executions.execute(contact)
    busy = false
    executions.stop(contact)
    expect(repository.executionsOf(contact)[0]?.outcome).toBe('arretee')
  })

  it('should_mark_an_execution_left_open_as_interrupted_at_startup', async () => {
    await executions.execute(contact)
    claudeWrites('a.md', 'x')
    executions.recover()
    expect(repository.executionsOf(contact)[0]?.outcome).toBe('interrompue')
    expect(finals.actionOf(contact)?.state).toBe('a_revoir')
  })

  it('should_trace_the_reads_and_end_as_failed_on_a_chat_error', async () => {
    await executions.execute(contact)
    const message = (text: string) => ({ id: 'm', role: 'tool' as const, text, createdAt: 'x' })
    executions.onChatEvent({ type: 'chat:tool', payload: { neuronId: contact, message: message('fichier lu') } })
    executions.onChatEvent({
      type: 'chat:error',
      payload: { neuronId: contact, code: 'PROCESS_FAILED', message: message('Interrompue'), resetsAt: null }
    })
    const [execution] = repository.executionsOf(contact)
    expect(execution?.outcome).toBe('echouee')
    expect(repository.eventsOf(execution?.id ?? '').map((event) => [event.kind, event.detail])).toEqual([
      ['lecture', 'fichier lu'],
      ['message', 'Interrompue']
    ])
  })
})
