import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NeuronService } from '../../../src/main/application/neurons/NeuronService'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { createGatewayHarness, type GatewayHarness } from '../../support/gateway'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('NeuronService', () => {
  let root: string
  let handle: DatabaseHandle
  let h: GatewayHarness
  let service: NeuronService

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-neuron-service-'))
    handle = openDatabase({ file: join(root, 'n.db'), key: '4'.repeat(64), migrationsFolder: MIGRATIONS })
    h = createGatewayHarness()
    service = new NeuronService({ repository: new NeuronRepository(handle.db), gateway: h.gateway })
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_create_raw_reflection_neuron_when_no_nature_is_given', async () => {
    h.ollama.setAvailable(false)
    const created = await service.create({ text: 'Concept de mon portfolio photo' })
    expect(created).toMatchObject({ title: 'Concept de mon portfolio photo', state: 'raw', nature: 'reflection' })
    expect(created.category).toBeNull()
  })

  it('should_use_first_line_as_title_and_keep_full_text_as_content', async () => {
    h.ollama.setAvailable(false)
    const created = await service.create({ text: 'Acheter un 2e écran\n27 pouces, budget à voir' })
    expect(created.title).toBe('Acheter un 2e écran')
    expect(created.content).toBe('Acheter un 2e écran\n27 pouces, budget à voir')
  })

  it('should_apply_ai_category_and_nature_when_local_ai_answers', async () => {
    h.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    const created = await service.create({ text: 'Acheter un flash cobra' })
    await service.settled()
    const tree = service.getTree(created.id)
    expect(tree.root).toMatchObject({ nature: 'action', natureSource: 'ai', categorySource: 'ai' })
    expect(tree.root.category?.slug).toBe('achat')
  })

  it('should_never_overwrite_user_choices_when_ai_categorizes_later', async () => {
    h.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    const created = await service.create({ text: 'Portfolio', nature: 'reflection' })
    await service.settled()
    expect(service.getTree(created.id).root).toMatchObject({ nature: 'reflection', natureSource: 'user' })
  })

  it('should_apply_queued_categorization_when_local_ai_comes_back', async () => {
    h.ollama.setAvailable(false)
    const created = await service.create({ text: 'Réserver un restaurant' })
    service.applyQueuedResult(`categorize:${created.id}`, { categorySlug: 'sortie', nature: 'action' })
    expect(service.getTree(created.id).root.category?.slug).toBe('sortie')
  })

  it('should_bump_version_and_mark_user_source_when_editing', async () => {
    h.ollama.setAvailable(false)
    const created = await service.create({ text: 'Idée' })
    const updated = service.update({ id: created.id, title: 'Idée précisée', categorySlug: 'projet' })
    expect(updated).toMatchObject({ title: 'Idée précisée', version: created.version + 1, categorySource: 'user' })
  })

  it('should_list_by_state_nature_category_and_accent_insensitive_search_with_pagination', async () => {
    h.ollama.setAvailable(false)
    for (const text of ['Acheter un écran', 'Écran de veille', 'Poterie', 'Vélo cargo']) await service.create({ text })
    const search = service.list({ search: 'ecran' })
    expect(search.items.map((item) => item.title).sort()).toEqual(['Acheter un écran', 'Écran de veille'])
    const firstPage = service.list({ limit: 3 })
    expect(firstPage.items).toHaveLength(3)
    const cursor = firstPage.nextCursor
    expect(cursor).not.toBeNull()
    const secondPage = service.list({ limit: 3, ...(cursor === null ? {} : { cursor }) })
    expect(secondPage.items).toHaveLength(1)
    expect(secondPage.nextCursor).toBeNull()
  })

  it('should_hide_archived_roots_from_default_listing', async () => {
    h.ollama.setAvailable(false)
    const created = await service.create({ text: 'À archiver' })
    service.archive(created.id)
    expect(service.list({}).items).toEqual([])
    expect(service.list({ state: 'archived' }).items).toHaveLength(1)
  })

  it('should_throw_not_found_when_root_does_not_exist', () => {
    expect(() => service.getTree('00000000-0000-4000-8000-000000000000')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
  })
})
