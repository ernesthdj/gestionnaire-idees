import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CaptureService } from '../../../src/main/application/capture/CaptureService'
import { NeuronService } from '../../../src/main/application/neurons/NeuronService'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AppSettingsRepository } from '../../../src/main/infrastructure/db/repositories/AppSettingsRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { createCaptureRoutes } from '../../../src/main/ipc/captureHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import { createGatewayHarness, type GatewayHarness } from '../../support/gateway'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('capture rapide', () => {
  let dir: string
  let handle: DatabaseHandle
  let h: GatewayHarness
  let neurons: NeuronService
  let drafts: AppSettingsRepository
  let openDive: ReturnType<typeof vi.fn<(rootId: string) => void>>
  let hide: ReturnType<typeof vi.fn<() => void>>
  let dispatch: ReturnType<typeof createDispatcher>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-capture-'))
    handle = openDatabase({ file: join(dir, 'c.db'), key: '9'.repeat(64), migrationsFolder: MIGRATIONS })
    h = createGatewayHarness()
    neurons = new NeuronService({ repository: new NeuronRepository(handle.db), gateway: h.gateway })
    drafts = new AppSettingsRepository(handle.db)
    openDive = vi.fn<(rootId: string) => void>()
    hide = vi.fn<() => void>()
    dispatch = createDispatcher(createCaptureRoutes(new CaptureService({ neurons, drafts, openDive }), hide))
  })

  afterEach(async () => {
    await neurons.settled()
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_create_a_raw_neuron_immediately_when_local_ai_is_down', async () => {
    h.ollama.setAvailable(false)
    const result = await dispatch('capture:submit', { text: 'Acheter un flash cobra', diveNow: false })
    expect(result).toMatchObject({ success: true })
    const rootId = result.success ? (result.data as { rootId: string }).rootId : ''
    // Sans IA : nature Réflexion par défaut, catégorie « À classer » (aucune), classée plus tard.
    expect(neurons.getTree(rootId).root).toMatchObject({ state: 'raw', nature: 'reflection', category: null })
    expect(openDive).not.toHaveBeenCalled()
  })

  it('should_apply_ai_nature_and_category_after_creation_when_local_ai_answers', async () => {
    h.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    const result = await dispatch('capture:submit', { text: 'Acheter un flash cobra', diveNow: false })
    const rootId = result.success ? (result.data as { rootId: string }).rootId : ''
    await neurons.settled()
    const root = neurons.getTree(rootId).root
    expect(root).toMatchObject({ nature: 'action', natureSource: 'ai', categorySource: 'ai' })
    expect(root.category?.slug).toBe('achat')
  })

  it('should_never_overwrite_a_user_choice_when_ai_categorizes_after_capture', async () => {
    let release = (): void => undefined
    h.ollama.setAvailable(true)
    h.ollama.enqueue({ raw: { categorySlug: 'achat', nature: 'action' } })
    const gate = new Promise<void>((resolve) => (release = resolve))
    const originalRun = h.gateway.run.bind(h.gateway)
    vi.spyOn(h.gateway, 'run').mockImplementation(async (request) => {
      await gate // l'utilisateur change la nature avant que l'IA ne réponde
      return originalRun(request)
    })
    const result = await dispatch('capture:submit', { text: 'Portfolio', diveNow: false })
    const rootId = result.success ? (result.data as { rootId: string }).rootId : ''
    neurons.update({ id: rootId, nature: 'reflection', categorySlug: 'photo' })
    release()
    await neurons.settled()
    expect(neurons.getTree(rootId).root).toMatchObject({
      nature: 'reflection',
      natureSource: 'user',
      categorySource: 'user'
    })
  })

  it('should_clear_the_draft_and_open_the_dive_when_submitted_with_ctrl_enter', async () => {
    h.ollama.setAvailable(false)
    await dispatch('capture:saveDraft', { text: 'Idée en cours' })
    const result = await dispatch('capture:submit', { text: 'Idée en cours', diveNow: true })
    const rootId = result.success ? (result.data as { rootId: string }).rootId : ''
    expect(openDive).toHaveBeenCalledWith(rootId)
    expect(await dispatch('capture:getDraft', undefined)).toEqual({ success: true, data: { text: '' } })
  })

  it('should_keep_the_draft_when_the_window_is_closed', async () => {
    await dispatch('capture:saveDraft', { text: 'À finir plus tard' })
    await dispatch('capture:close', undefined)
    expect(hide).toHaveBeenCalledOnce()
    expect(await dispatch('capture:getDraft', undefined)).toEqual({
      success: true,
      data: { text: 'À finir plus tard' }
    })
  })

  it.each([
    ['vide', '   '],
    ['trop long', 'x'.repeat(2001)]
  ])('should_create_nothing_when_the_text_is_%s', async (_case, text) => {
    const result = await dispatch('capture:submit', { text, diveNow: false })
    expect(result).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
    expect(neurons.list({}).items).toHaveLength(0)
  })
})
