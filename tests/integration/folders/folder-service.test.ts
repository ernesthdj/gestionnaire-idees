import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { DocumentService } from '../../../src/main/application/documents/DocumentService'
import { mapNodes } from '../../../src/main/application/documents/mapNodes'
import { FolderService } from '../../../src/main/application/folders/FolderService'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { DocumentRepository } from '../../../src/main/infrastructure/db/repositories/DocumentRepository'
import { FolderRepository } from '../../../src/main/infrastructure/db/repositories/FolderRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { WorkflowChatRepository } from '../../../src/main/infrastructure/db/repositories/WorkflowChatRepository'
import { documents, neurons } from '../../../src/main/infrastructure/db/schemaNeurons'
import { DocumentFiles } from '../../../src/main/infrastructure/documents/DocumentFiles'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

/** Spec 028 T010 : le dossier d'un nœud dans la vue de la carte — documents rangés, « nouveau », place, annulation. */
describe('dossier d’un nœud sur la carte (spec 028 US1)', () => {
  let t: NeuronHarness
  let root: string
  let clock: number
  let docs: DocumentService
  let folders: FolderService
  let canvas: CanvasService
  let history: HistoryService
  let workflowChats: WorkflowChatRepository
  let genesis: string

  beforeEach(async () => {
    t = createNeuronHarness()
    root = mkdtempSync(join(tmpdir(), 'gi-folders-'))
    mkdirSync(join(root, 'profil'))
    const db = t.handle.db
    const repository = new DocumentRepository(db)
    docs = new DocumentService({
      repository,
      files: new DocumentFiles({ profileDir: join(root, 'profil') }),
      nodes: mapNodes(new ConversationRepository(db)),
      projectDir: () => null
    })
    clock = Date.parse('2026-10-12T20:00:00.000Z')
    workflowChats = new WorkflowChatRepository(db)
    folders = new FolderService({
      repository: new FolderRepository(db),
      documents: repository,
      workflowChats: () => workflowChats.chats(),
      now: () => new Date(clock)
    })
    canvas = new CanvasService({
      neurons: new NeuronRepository(db),
      blocks: new BlockRepository(db),
      io: { links: () => [] },
      plan: new PlanRepository(db),
      documents: repository,
      folders
    })
    history = new HistoryService(new HistoryRepository(db), docs.historyHandlers())
    genesis = (await t.neurons.create({ text: 'Cours de comptabilité' })).id
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  const write = (title: string, neuronId = genesis, author: 'claude' | 'user' = 'claude') =>
    docs.create({ neuronId, title, content: `# ${title}`, author })
  const pause = (): Promise<void> => new Promise((done) => setTimeout(done, 5))
  const folderOf = (neuronId: string) => canvas.get().folders?.find((folder) => folder.neuronId === neuronId)

  it('should_file_a_new_document_in_the_folder_of_its_node_instead_of_drawing_it_on_the_map', () => {
    write('Bilan')
    const view = canvas.get()
    expect(view.documents).toEqual([])
    expect(folderOf(genesis)).toMatchObject({
      anchor: { kind: 'neuron', id: genesis },
      count: 1,
      unseen: true,
      offset: { x: 0, y: 0 },
      moved: false,
      preview: [expect.objectContaining({ name: 'bilan.md', kind: 'doc', source: 'document', unseen: true })]
    })
    expect(folderOf(genesis)?.preview[0]?.document).toMatchObject({ title: 'Bilan', fileLabel: 'documents/bilan.md' })
  })

  it('should_show_at_most_four_files_most_recent_first_and_count_them_all', () => {
    for (const [index, title] of ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq'].entries()) {
      clock += index
      write(title)
    }
    const folder = folderOf(genesis)
    expect(folder?.count).toBe(5)
    expect(folder?.preview).toHaveLength(4)
  })

  it('should_stop_marking_files_new_when_the_folder_is_opened_until_claude_writes_again', async () => {
    // Les versions sont datées par la base, à l'heure réelle : l'ouverture aussi.
    const { document } = write('Bilan')
    await pause()
    clock = Date.now()
    folders.markSeen(genesis)
    expect(folderOf(genesis)?.unseen).toBe(false)
    // Un document de mentalyas n'est jamais « nouveau ».
    write('Mes notes', genesis, 'user')
    expect(folderOf(genesis)?.unseen).toBe(false)
    await pause()
    docs.write({ documentId: document.id, content: 'Suite', mode: 'ajouter', author: 'claude' })
    expect(folderOf(genesis)?.unseen).toBe(true)
  })

  it('should_keep_a_dragged_place_within_bounds', () => {
    write('Bilan')
    folders.move(genesis, 240, -60)
    expect(folderOf(genesis)).toMatchObject({ offset: { x: 240, y: -60 }, moved: true })
    expect(() => folders.move(genesis, 20_000, 0)).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })

  it('should_drop_the_folder_when_its_last_document_is_undone_and_keep_pinned_documents_on_the_map', () => {
    const { batchId } = write('Bilan')
    history.undo(batchId)
    expect(folderOf(genesis)).toBeUndefined()
    const { document } = write('Plan')
    t.handle.db.update(documents).set({ pinned: true }).where(eq(documents.id, document.id)).run()
    expect(folderOf(genesis)).toBeUndefined()
    expect(canvas.get().documents.map((entry) => entry.title)).toEqual(['Plan'])
  })

  it('should_hide_the_folder_of_an_archived_node_and_bring_it_back_when_restored', () => {
    write('Bilan')
    t.handle.db.update(neurons).set({ state: 'archived' }).where(eq(neurons.id, genesis)).run()
    expect(folderOf(genesis)).toBeUndefined()
    t.handle.db.update(neurons).set({ state: 'raw' }).where(eq(neurons.id, genesis)).run()
    expect(folderOf(genesis)?.count).toBe(1)
  })

  it('should_anchor_the_folder_of_a_workflow_conversation_to_its_workflow_node', () => {
    const chat = '00000000-0000-4000-8000-0000000000f1'
    workflowChats.insert({ id: chat, genesisId: genesis, key: `wf:${genesis}:task:028:T010`, title: 'T010' })
    write('Notes de tâche', chat)
    expect(folderOf(chat)?.anchor).toEqual({ kind: 'workflow', key: `wf:${genesis}:task:028:T010`, genesisId: genesis })
  })

  it('should_add_less_than_20_ms_to_the_map_view_with_30_nodes_and_60_documents', async () => {
    for (let index = 0; index < 30; index++) {
      const id = (await t.neurons.create({ text: `Idée ${index}` })).id
      write(`Doc A ${index}`, id)
      write(`Doc B ${index}`, id)
    }
    const db = t.handle.db
    const without = new CanvasService({
      neurons: new NeuronRepository(db),
      blocks: new BlockRepository(db),
      io: { links: () => [] },
      plan: new PlanRepository(db),
      documents: new DocumentRepository(db)
    })
    const average = (run: () => unknown): number => {
      run()
      const started = performance.now()
      for (let round = 0; round < 10; round++) run()
      return (performance.now() - started) / 10
    }
    expect(canvas.get().folders).toHaveLength(30)
    expect(average(() => canvas.get()) - average(() => without.get())).toBeLessThan(20)
  })

  it('should_show_the_files_an_element_already_covers_without_any_document_written', async () => {
    // Cours PLGI : le .md écrit dans le projet sous un chemin de l'élément est déjà dans son dossier.
    const element = (await t.neurons.create({ text: 'Actif = Passif' })).id
    const db = t.handle.db
    const withElements = new CanvasService({
      neurons: new NeuronRepository(db),
      blocks: new BlockRepository(db),
      io: { links: () => [] },
      plan: new PlanRepository(db),
      documents: new DocumentRepository(db),
      folders,
      elements: {
        views: () => [
          {
            id: element,
            genesisId: genesis,
            parentId: genesis,
            key: 'module:actif-passif',
            type: 'module',
            title: 'Actif = Passif',
            status: 'en_cours',
            summary: null,
            paths: ['cours/actif-passif/'],
            collapsed: false,
            childCount: 0,
            order: null
          }
        ]
      },
      projectFiles: () => ['cours/actif-passif/exercices.ts', 'cours/actif-passif/cours.md', 'autre/x.md']
    })
    const folder = withElements.get().folders?.find((entry) => entry.neuronId === element)
    expect(folder).toMatchObject({ count: 2, unseen: false })
    expect(folder?.preview.map((file) => [file.path, file.source, file.kind])).toEqual([
      ['cours/actif-passif/cours.md', 'covered', 'doc'],
      ['cours/actif-passif/exercices.ts', 'covered', 'code']
    ])
  })
})
