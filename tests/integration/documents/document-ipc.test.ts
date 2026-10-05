import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CanvasService } from '../../../src/main/application/canvas/CanvasService'
import { DocumentService } from '../../../src/main/application/documents/DocumentService'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { DocumentRepository } from '../../../src/main/infrastructure/db/repositories/DocumentRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { PlanRepository } from '../../../src/main/infrastructure/db/repositories/PlanRepository'
import { DocumentFiles } from '../../../src/main/infrastructure/documents/DocumentFiles'
import { createCanvasRoutes } from '../../../src/main/ipc/canvasHandlers'
import { createDocumentRoutes } from '../../../src/main/ipc/documentHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import type { IdeasCanvasView } from '../../../src/shared/ipc/canvas'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('documents côté interface (spec 012 US1, canaux)', () => {
  let t: NeuronHarness
  let root: string
  let documents: DocumentService
  let revealed: string[]
  let dispatch: ReturnType<typeof createDispatcher>
  let genesis: string

  beforeEach(async () => {
    t = createNeuronHarness()
    root = mkdtempSync(join(tmpdir(), 'gi-docipc-'))
    mkdirSync(join(root, 'profil'))
    const repository = new DocumentRepository(t.handle.db)
    const plans = new PlanRepository(t.handle.db)
    documents = new DocumentService({
      repository,
      files: new DocumentFiles({ profileDir: join(root, 'profil') }),
      nodes: plans,
      projectDir: () => null
    })
    revealed = []
    const canvas = new CanvasService({
      neurons: new NeuronRepository(t.handle.db),
      blocks: new BlockRepository(t.handle.db),
      io: { links: () => [] },
      plan: plans,
      documents: repository
    })
    dispatch = createDispatcher([
      ...createCanvasRoutes(canvas),
      ...createDocumentRoutes({ documents, reveal: (path) => revealed.push(path) })
    ])
    genesis = (await t.neurons.create({ text: 'Ouvrir un studio photo' })).id
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  const view = async (): Promise<IdeasCanvasView> => {
    const result = await dispatch('canvas:get', {})
    if (!result.success) throw new Error(result.error.code)
    return result.data as IdeasCanvasView
  }

  it('should_list_the_documents_of_visible_neurons_with_a_readable_location', async () => {
    const { document } = documents.create({ neuronId: genesis, title: 'Budget', content: '# B', author: 'claude' })
    expect((await view()).documents).toEqual([
      {
        id: document.id,
        neuronId: genesis,
        genesisId: genesis,
        title: 'Budget',
        fileLabel: 'documents/budget.md',
        width: 360,
        height: 280,
        origin: 'claude',
        offset: { x: 0, y: 0 }
      }
    ])
    await t.neurons.archive(genesis)
    expect((await view()).documents).toEqual([])
  })

  it('should_return_the_content_remove_the_node_and_reveal_the_file_resolved_by_the_main', async () => {
    const { document } = documents.create({ neuronId: genesis, title: 'Budget', content: '# B', author: 'claude' })
    expect(await dispatch('document:get', { id: document.id })).toMatchObject({
      success: true,
      data: { id: document.id, content: '# B', missing: false }
    })
    expect((await dispatch('document:reveal', { id: document.id })).success).toBe(true)
    expect(revealed).toEqual([join(root, 'profil', 'documents', 'budget.md')])
    expect((await dispatch('document:remove', { id: document.id })).success).toBe(true)
    expect((await view()).documents).toEqual([])
  })

  it('should_remember_where_a_document_was_dragged_and_its_new_size_within_bounds', async () => {
    const { document } = documents.create({ neuronId: genesis, title: 'Budget', content: '# B', author: 'claude' })
    expect((await dispatch('document:move', { id: document.id, x: -400, y: 120 })).success).toBe(true)
    expect((await dispatch('document:resize', { id: document.id, width: 600, height: 900 })).success).toBe(true)
    expect((await view()).documents[0]).toMatchObject({ offset: { x: -400, y: 120 }, width: 600, height: 900 })
    expect(await dispatch('document:resize', { id: document.id, width: 100, height: 900 })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
    expect(await dispatch('document:move', { id: document.id, x: 1e9, y: 0 })).toMatchObject({
      success: false,
      error: { code: 'VALIDATION' }
    })
  })

  it.each([{ id: 'pas-un-uuid' }, { id: '00000000-0000-4000-8000-000000000000', chemin: 'C:/x' }])(
    'should_refuse_an_invalid_payload_%o',
    async (payload) => {
      expect(await dispatch('document:reveal', payload)).toMatchObject({
        success: false,
        error: { code: 'VALIDATION' }
      })
      expect(revealed).toEqual([])
    }
  )
})
