import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DocumentService } from '../../../src/main/application/documents/DocumentService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { PlanService } from '../../../src/main/application/plan/PlanService'
import { DocumentRepository } from '../../../src/main/infrastructure/db/repositories/DocumentRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { neurons } from '../../../src/main/infrastructure/db/schemaNeurons'
import { DocumentFiles } from '../../../src/main/infrastructure/documents/DocumentFiles'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('documents des neurones (spec 012 US1)', () => {
  let t: NeuronHarness
  let root: string
  let profile: string
  let project: string
  let repository: DocumentRepository
  let plans: PlanRepository
  let service: DocumentService
  let history: HistoryService
  let genesis: string

  beforeEach(async () => {
    t = createNeuronHarness()
    root = mkdtempSync(join(tmpdir(), 'gi-docsvc-'))
    profile = join(root, 'profil')
    project = join(root, 'projet')
    mkdirSync(profile)
    mkdirSync(project)
    repository = new DocumentRepository(t.handle.db)
    plans = new PlanRepository(t.handle.db)
    service = new DocumentService({
      repository,
      files: new DocumentFiles({ profileDir: profile }),
      nodes: plans,
      projectDir: (genesisId) =>
        t.handle.db.select({ dir: neurons.projectDir }).from(neurons).where(eq(neurons.id, genesisId)).get()?.dir ??
        null
    })
    history = new HistoryService(new HistoryRepository(t.handle.db), service.historyHandlers())
    genesis = (await t.neurons.create({ text: 'Ouvrir un studio photo' })).id
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  const linkProject = (): void => {
    t.handle.db.update(neurons).set({ projectDir: project }).where(eq(neurons.id, genesis)).run()
  }
  const profileFile = (name: string): string => join(profile, 'documents', name)

  it('should_write_the_document_in_the_profile_and_record_a_first_version_in_one_undoable_batch', () => {
    const { document, batchId } = service.create({
      neuronId: genesis,
      title: 'Budget du studio',
      content: '# Budget\n\n- 900 €',
      author: 'claude'
    })
    expect(document).toMatchObject({ folder: 'profile', fileName: 'budget-du-studio.md', origin: 'claude' })
    expect(readFileSync(profileFile('budget-du-studio.md'), 'utf8')).toBe('# Budget\n\n- 900 €')
    expect(repository.latestVersion(document.id)).toMatchObject({ author: 'claude', content: '# Budget\n\n- 900 €' })
    expect(history.list().items[0]).toMatchObject({ batchId, summary: 'Document « Budget du studio »', undoable: true })
  })

  it('should_write_in_docs_brainstormer_of_the_project_linked_to_the_genesis_even_for_a_step', () => {
    linkProject()
    const plan = new PlanService({ repository: plans })
    const { proposalId } = plan.propose({
      parentId: genesis,
      steps: [{ key: 'a', title: 'Choisir le lieu', why: 'x' }]
    })
    plan.decide({ proposalId, accept: plans.proposal(proposalId)?.items.map((item) => item.id) ?? [], reject: [] })
    const step = plans.children(genesis)[0]?.id ?? ''
    const { document } = service.create({ neuronId: step, title: 'Lieu', content: 'Liège', author: 'claude' })
    expect(document).toMatchObject({ folder: 'project', neuronId: step, genesisId: genesis })
    expect(readFileSync(join(project, 'docs', 'brainstormer', 'lieu.md'), 'utf8')).toBe('Liège')
  })

  it('should_never_overwrite_an_existing_file_and_allow_several_documents_per_neuron', () => {
    mkdirSync(join(profile, 'documents'))
    writeFileSync(profileFile('budget.md'), 'à moi')
    const first = service.create({ neuronId: genesis, title: 'Budget', content: 'a', author: 'claude' }).document
    const second = service.create({ neuronId: genesis, title: 'Budget', content: 'b', author: 'claude' }).document
    expect([first.fileName, second.fileName]).toEqual(['budget-2.md', 'budget-3.md'])
    expect(readFileSync(profileFile('budget.md'), 'utf8')).toBe('à moi')
    expect(repository.ofNeuron(genesis)).toHaveLength(2)
  })

  it('should_replace_or_append_with_a_new_version_and_undo_back_to_the_previous_content', () => {
    const { document } = service.create({ neuronId: genesis, title: 'Plan', content: 'v1', author: 'claude' })
    service.write({ documentId: document.id, content: 'v2', mode: 'remplacer', author: 'claude' })
    const { batchId } = service.write({ documentId: document.id, content: 'suite', mode: 'ajouter', author: 'claude' })
    expect(readFileSync(profileFile('plan.md'), 'utf8')).toBe('v2\n\nsuite')
    expect(history.list().items[0]?.summary).toBe('Modification de « Plan »')
    history.undo(batchId)
    expect(readFileSync(profileFile('plan.md'), 'utf8')).toBe('v2')
    expect(service.read(document.id)).toMatchObject({ content: 'v2', missing: false })
  })

  it('should_move_the_file_to_the_trash_when_the_creation_is_undone_and_bring_it_back_on_redo', () => {
    const { document, batchId } = service.create({ neuronId: genesis, title: 'Plan', content: 'v1', author: 'claude' })
    const { undoBatchId } = history.undo(batchId)
    expect(existsSync(profileFile('plan.md'))).toBe(false)
    expect(readdirSync(join(profile, 'documents', '.corbeille'))).toHaveLength(1)
    expect(repository.list()).toEqual([])
    history.undo(undoBatchId)
    expect(readFileSync(profileFile('plan.md'), 'utf8')).toBe('v1')
    expect(repository.list().map((row) => row.id)).toEqual([document.id])
  })

  it('should_record_an_external_version_when_the_file_changed_outside_the_app', () => {
    const { document } = service.create({ neuronId: genesis, title: 'Plan', content: 'v1', author: 'claude' })
    writeFileSync(profileFile('plan.md'), 'retouché dans Obsidian')
    expect(service.read(document.id)).toMatchObject({ content: 'retouché dans Obsidian', missing: false })
    expect(repository.latestVersion(document.id)?.author).toBe('externe')
  })

  it('should_show_the_last_version_and_recreate_the_file_when_it_disappeared', () => {
    const { document } = service.create({ neuronId: genesis, title: 'Plan', content: 'v1', author: 'claude' })
    rmSync(profileFile('plan.md'))
    expect(service.read(document.id)).toMatchObject({ content: 'v1', missing: true })
    service.recreate(document.id)
    expect(readFileSync(profileFile('plan.md'), 'utf8')).toBe('v1')
  })

  it('should_accept_documents_for_a_locked_neuron', () => {
    t.handle.db.update(neurons).set({ lockedAt: '2026-10-05' }).where(eq(neurons.id, genesis)).run()
    expect(() => service.create({ neuronId: genesis, title: 'Plan', content: 'x', author: 'claude' })).not.toThrow()
  })

  it('should_refuse_and_write_nothing_elsewhere_when_the_linked_project_folder_is_gone', () => {
    t.handle.db
      .update(neurons)
      .set({ projectDir: join(root, 'disparu') })
      .where(eq(neurons.id, genesis))
      .run()
    expect(() => service.create({ neuronId: genesis, title: 'Plan', content: 'x', author: 'claude' })).toThrow(
      expect.objectContaining({ code: 'FOLDER_MISSING' })
    )
    expect(existsSync(join(profile, 'documents'))).toBe(false)
    expect(repository.list()).toEqual([])
  })

  it('should_remove_a_document_from_the_map_but_keep_its_file_and_undo_the_removal', () => {
    const { document } = service.create({ neuronId: genesis, title: 'Plan', content: 'v1', author: 'claude' })
    const { batchId } = service.remove(document.id)
    expect(repository.list()).toEqual([])
    expect(existsSync(profileFile('plan.md'))).toBe(true)
    expect(history.list().items[0]?.summary).toBe('Retrait du document « Plan »')
    history.undo(batchId)
    expect(repository.list().map((row) => row.id)).toEqual([document.id])
  })

  it('should_refuse_an_unknown_neuron_or_a_structure_element', () => {
    expect(() => service.create({ neuronId: 'inconnu', title: 'x', content: 'x', author: 'claude' })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
  })
})
