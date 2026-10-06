import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RepriseService } from '../../../src/main/application/reprise/RepriseService'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

const FIXTURES = resolve(import.meta.dirname, '../../fixtures/reprise')

describe('reprendre un projet depuis un dossier (spec 017 US1)', () => {
  let t: NeuronHarness
  let root: string
  let project: string
  let dataDir: string
  let picked: string | undefined
  let clock: number
  let reprise: RepriseRepository
  let conversations: ConversationRepository
  let service: RepriseService
  let limit: number

  beforeEach(() => {
    t = createNeuronHarness()
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-reprise-')))
    project = join(root, 'laravel-app')
    cpSync(join(FIXTURES, 'laravel-app'), project, { recursive: true })
    // Ce que le dépôt public ne peut pas porter : un vrai fichier de secrets et des dépendances installées.
    writeFileSync(join(project, '.env'), 'APP_KEY=faux-secret-de-test\n')
    mkdirSync(join(project, 'vendor', 'laravel'), { recursive: true })
    writeFileSync(join(project, 'vendor', 'laravel', 'framework.php'), '<?php')
    writeFileSync(join(project, '.gitignore'), 'storage/\n')
    mkdirSync(join(project, 'storage'))
    writeFileSync(join(project, 'storage', 'cache.php'), '<?php')
    dataDir = join(root, 'profil')
    mkdirSync(dataDir)
    picked = project
    clock = Date.parse('2026-10-06T20:00:00.000Z')
    limit = 20_000
    reprise = new RepriseRepository(t.handle.db)
    conversations = new ConversationRepository(t.handle.db)
    service = new RepriseService({
      repository: reprise,
      pickFolder: async () => picked,
      scan: (folder) => scanProject(folder, limit),
      linkedFolders: () => conversations.linkedFolders(),
      createGenesis: async (title) => (await t.neurons.create({ text: title })).id,
      attach: (neuronId, dir) => conversations.setProjectDir(neuronId, dir, 'session'),
      dataDir,
      now: () => new Date(clock)
    })
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_preview_languages_and_counts_without_reading_the_secret_file', async () => {
    const preview = await service.previewFolder()
    expect(preview).toMatchObject({
      name: 'laravel-app',
      languages: [{ lang: 'php', files: 5 }],
      // 5 PHP + composer.json + .gitignore ; ni .env, ni vendor/, ni storage/ (ignoré par le .gitignore).
      files: 7,
      sensitive: 1,
      git: false,
      tooLarge: false,
      alreadyLinked: null
    })
    expect(preview?.ignored).toBeGreaterThanOrEqual(2)
    expect(JSON.stringify(preview)).not.toContain(root)
  })

  it('should_return_null_when_the_picker_is_cancelled', async () => {
    picked = undefined
    expect(await service.previewFolder()).toBeNull()
  })

  it.each([
    ['the_data_folder', () => join(root, 'profil')],
    ['a_parent_of_the_data_folder', () => root]
  ])('should_refuse_%s', async (_label, folder) => {
    picked = folder()
    await expect(service.previewFolder()).rejects.toMatchObject({ code: 'FOLDER_REFUSED' })
  })

  it('should_create_a_genesis_linked_to_its_source_folder_with_the_chosen_confidentiality', async () => {
    const preview = await service.previewFolder()
    const { genesisId } = await service.create(preview?.previewId ?? '', 'local')
    expect(conversations.neuron(genesisId)).toMatchObject({ title: 'laravel-app', projectDir: project })
    expect(service.view(genesisId)).toMatchObject({
      name: 'laravel-app',
      source: 'folder',
      confidentiality: 'local',
      remote: null,
      folderMissing: false,
      analysis: { state: 'idle' }
    })
    await expect(service.create(preview?.previewId ?? '', 'local')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('should_offer_the_existing_neuron_when_the_folder_is_already_linked', async () => {
    const other = (await t.neurons.create({ text: 'Lié à la main' })).id
    conversations.setProjectDir(other, project.toUpperCase(), 'session')
    const preview = await service.previewFolder()
    expect(preview?.alreadyLinked).toBe(other)
    await expect(service.create(preview?.previewId ?? '', 'claude')).rejects.toMatchObject({
      code: 'ALREADY_LINKED',
      details: { neuronId: other }
    })
  })

  it('should_forget_a_preview_after_fifteen_minutes', async () => {
    const preview = await service.previewFolder()
    clock += 16 * 60_000
    await expect(service.create(preview?.previewId ?? '', 'local')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('should_refuse_a_project_beyond_the_file_limit', async () => {
    limit = 3
    const preview = await service.previewFolder()
    expect(preview?.tooLarge).toBe(true)
    await expect(service.create(preview?.previewId ?? '', 'local')).rejects.toMatchObject({ code: 'TOO_LARGE' })
  })

  it('should_confirm_before_allowing_claude_and_go_back_to_local_at_once', async () => {
    const preview = await service.previewFolder()
    const { genesisId } = await service.create(preview?.previewId ?? '', 'local')
    expect(() => service.setConfidentiality(genesisId, 'claude')).toThrow(
      expect.objectContaining({ code: 'CONFIRM_REQUIRED' })
    )
    expect(reprise.project(genesisId)?.confidentiality).toBe('local')
    expect(service.setConfidentiality(genesisId, 'claude', true)).toEqual({ level: 'claude' })
    expect(service.setConfidentiality(genesisId, 'local')).toEqual({ level: 'local' })
  })

  it('should_tell_when_the_source_folder_has_disappeared', async () => {
    const preview = await service.previewFolder()
    const { genesisId } = await service.create(preview?.previewId ?? '', 'local')
    rmSync(project, { recursive: true, force: true })
    expect(service.view(genesisId).folderMissing).toBe(true)
  })
})
