import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { DeliverableService } from '../../../src/main/application/finals/DeliverableService'
import { ExecutionService } from '../../../src/main/application/finals/ExecutionService'
import { FinalService } from '../../../src/main/application/finals/FinalService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { correctionMessage } from '../../../src/main/domain/finals/executionBrief'
import { FinalRepository } from '../../../src/main/infrastructure/db/repositories/FinalRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { ProjectFiles } from '../../../src/main/infrastructure/finals/ProjectFiles'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('revoir le livrable (spec 013 US3, T018)', () => {
  let t: NeuronHarness
  let root: string
  let project: string
  let linked: string | null
  let repository: FinalRepository
  let plan: PlanRepository
  let executions: ExecutionService
  let review: DeliverableService
  let history: HistoryService
  let busy: boolean
  let send: Mock<(neuronId: string, text: string, data?: string) => Promise<void>>
  let changed: string[]
  let step: string

  beforeEach(async () => {
    t = createNeuronHarness()
    root = mkdtempSync(join(tmpdir(), 'gi-review-'))
    project = join(root, 'site')
    mkdirSync(project)
    mkdirSync(join(root, 'profil'))
    writeFileSync(join(project, 'README.md'), '# Site\n\nAccueil.\n')
    linked = project
    repository = new FinalRepository(t.handle.db)
    plan = new PlanRepository(t.handle.db)
    const finals = new FinalService({ repository, plan })
    busy = false
    send = vi.fn(async () => {
      busy = true
    })
    changed = []
    const files = new ProjectFiles({ profileDir: join(root, 'profil') })
    executions = new ExecutionService({
      repository,
      plan,
      projectDir: () => linked,
      documents: () => [],
      files,
      conversations: { send, stop: vi.fn(), isBusy: () => busy },
      emit: () => undefined
    })
    review = new DeliverableService({
      repository,
      plan,
      projectDir: () => linked,
      files,
      executions,
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
      steps: [{ key: 'contact', title: 'Page contact', why: 'x' }]
    })
    ;[step = ''] = service.decide({
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

  const turnEnd = (): void => {
    busy = false
    executions.onChatEvent({ type: 'chat:turnEnd', payload: { neuronId: step, message: null, interrupted: false } })
  }
  const claudeWrites = (relative: string, content: string): void => {
    const target = join(project, ...relative.split('/'))
    const before = existsSync(target) ? readFileSync(target, 'utf8') : null
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, content)
    executions.recordWrite(step, relative, before, content)
  }
  /** Une exécution terminée qui a créé un fichier et en a modifié un autre. */
  const executed = async (): Promise<void> => {
    await executions.execute(step)
    claudeWrites('src/Contact.tsx', 'export const A = 1\n')
    claudeWrites('README.md', '# Site\n\nContact.\n')
    turnEnd()
  }
  const statusOf = (): string | undefined => plan.steps().find((entry) => entry.id === step)?.status

  describe('deliverable:get', () => {
    it('should_list_the_files_with_before_after_and_the_execution_trail', async () => {
      await executed()
      const detail = review.get(step)
      expect(detail).toMatchObject({ neuronId: step, state: 'a_revoir', accepted: false })
      expect(detail.files).toEqual([
        {
          path: 'src/Contact.tsx',
          status: 'cree',
          before: null,
          after: 'export const A = 1\n',
          changedSince: false,
          current: null,
          reverted: false
        },
        {
          path: 'README.md',
          status: 'modifie',
          before: '# Site\n\nAccueil.\n',
          after: '# Site\n\nContact.\n',
          changedSince: false,
          current: null,
          reverted: false
        }
      ])
      expect(detail.executions).toHaveLength(1)
      expect(detail.executions[0]).toMatchObject({ outcome: 'terminee', correction: null, filesWritten: 2 })
      expect(detail.executions[0]?.events.map((event) => [event.kind, event.path])).toEqual([
        ['ecriture', 'src/Contact.tsx'],
        ['ecriture', 'README.md']
      ])
    })

    it('should_flag_a_file_edited_by_hand_and_give_its_current_content', async () => {
      await executed()
      writeFileSync(join(project, 'README.md'), '# Site\n\nRetouché à la main.\n')
      const file = review.get(step).files.find((entry) => entry.path === 'README.md')
      expect(file).toMatchObject({ changedSince: true, current: '# Site\n\nRetouché à la main.\n', reverted: false })
    })

    it('should_flag_a_deleted_file_without_current_content', async () => {
      await executed()
      rmSync(join(project, 'src', 'Contact.tsx'))
      const file = review.get(step).files.find((entry) => entry.path === 'src/Contact.tsx')
      expect(file).toMatchObject({ changedSince: true, current: null })
    })

    it('should_refuse_a_proposal_and_an_unknown_action', async () => {
      expect(() => review.get('00000000-0000-4000-8000-000000000000')).toThrow(/introuvable/)
    })
  })

  describe('deliverable:accept', () => {
    it('should_mark_the_step_done_in_an_undoable_batch', async () => {
      await executed()
      review.accept(step)
      expect(statusOf()).toBe('fait')
      expect(review.get(step).accepted).toBe(true)
      expect(changed).toContain(step)
      const [head] = history.list().items
      expect(head?.summary).toBe('Livrable accepté')
      history.undo(head?.batchId ?? '')
      expect(statusOf()).not.toBe('fait')
    })

    it('should_refuse_before_any_execution_during_one_and_twice', async () => {
      expect(() => review.accept(step)).toThrow(/pas encore de livrable/)
      await executions.execute(step)
      expect(() => review.accept(step)).toThrow(/exécute cette action/)
      claudeWrites('a.md', 'x')
      turnEnd()
      review.accept(step)
      expect(() => review.accept(step)).toThrow(/déjà accepté/)
    })
  })

  describe('deliverable:correct', () => {
    it('should_start_a_new_pass_with_the_correction_and_keep_the_original_before', async () => {
      await executed()
      send.mockClear()
      const { executionId } = await review.correct(step, '  Ajoute un champ téléphone.  ')
      expect(send.mock.calls[0]?.[1]).toBe(correctionMessage('Ajoute un champ téléphone.'))
      expect(repository.executionsOf(step)[0]).toMatchObject({
        id: executionId,
        correction: 'Ajoute un champ téléphone.'
      })
      expect(repository.active(step)?.state).toBe('en_cours')
      claudeWrites('README.md', '# Site\n\nContact et téléphone.\n')
      turnEnd()
      const readme = review.get(step).files.find((entry) => entry.path === 'README.md')
      expect(readme).toMatchObject({ before: '# Site\n\nAccueil.\n', after: '# Site\n\nContact et téléphone.\n' })
      expect(review.get(step).executions.map((execution) => execution.correction)).toEqual([
        'Ajoute un champ téléphone.',
        null
      ])
    })

    it.each([
      ['vide', '   '],
      ['trop longue', 'x'.repeat(4001)]
    ])('should_refuse_a_correction_%s', async (_label, message) => {
      await executed()
      await expect(review.correct(step, message)).rejects.toMatchObject({ code: 'VALIDATION' })
    })

    it('should_refuse_when_the_deliverable_is_already_accepted_or_the_action_is_running', async () => {
      await executed()
      review.accept(step)
      await expect(review.correct(step, 'encore')).rejects.toMatchObject({ code: 'INVALID_STATE' })
    })
  })

  describe('deliverable:revert', () => {
    it('should_restore_modified_files_and_trash_created_ones_in_one_undoable_batch', async () => {
      await executed()
      expect(review.revert(step)).toEqual({ restored: ['src/Contact.tsx', 'README.md'], skipped: [] })
      expect(readFileSync(join(project, 'README.md'), 'utf8')).toBe('# Site\n\nAccueil.\n')
      expect(existsSync(join(project, 'src', 'Contact.tsx'))).toBe(false)
      expect(readdirSync(join(root, 'profil', 'documents', '.corbeille'))).toHaveLength(1)
      expect(review.get(step).files.map((file) => [file.path, file.reverted, file.changedSince])).toEqual([
        ['src/Contact.tsx', true, false],
        ['README.md', true, false]
      ])
      const [head] = history.list().items
      expect(head?.summary).toBe('Livrable : retour en arrière (2 fichiers)')
      // Annuler le lot rend à Claude ce qu'il avait écrit.
      history.undo(head?.batchId ?? '')
      expect(readFileSync(join(project, 'README.md'), 'utf8')).toBe('# Site\n\nContact.\n')
      expect(readFileSync(join(project, 'src', 'Contact.tsx'), 'utf8')).toBe('export const A = 1\n')
      expect(review.get(step).files.every((file) => !file.reverted && !file.changedSince)).toBe(true)
    })

    it('should_spare_a_file_edited_by_hand_and_report_it', async () => {
      await executed()
      writeFileSync(join(project, 'README.md'), '# Site\n\nRetouché.\n')
      expect(review.revert(step)).toEqual({ restored: ['src/Contact.tsx'], skipped: ['README.md'] })
      expect(readFileSync(join(project, 'README.md'), 'utf8')).toBe('# Site\n\nRetouché.\n')
    })

    it('should_do_nothing_twice_and_log_nothing_when_no_file_is_restored', async () => {
      await executed()
      review.revert(step)
      const entries = history.list().items.length
      expect(review.revert(step)).toEqual({ restored: [], skipped: [] })
      expect(history.list().items).toHaveLength(entries)
    })

    it('should_refuse_during_an_execution_and_without_a_linked_folder', async () => {
      await executed()
      linked = null
      expect(() => review.revert(step)).toThrow(/dossier de projet/)
      linked = project
      busy = false
      await executions.execute(step, { force: true })
      expect(() => review.revert(step)).toThrow(/exécute cette action/)
    })
  })
})
