import { randomUUID } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryService } from '../../../src/main/application/history/HistoryService'
import { RepriseService } from '../../../src/main/application/reprise/RepriseService'
import { ConversationRepository } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import { HistoryRepository } from '../../../src/main/infrastructure/db/repositories/HistoryRepository'
import { RepriseRepository } from '../../../src/main/infrastructure/db/repositories/RepriseRepository'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'
import { REPRISE_FIXTURES } from '../../support/reprise'

describe('supprimer une idée retire son lien vers le dossier (spec 017 D9)', () => {
  let t: NeuronHarness
  let root: string
  let project: string
  let conversations: ConversationRepository
  let reprise: RepriseRepository
  let history: HistoryService
  let service: RepriseService

  beforeEach(() => {
    t = createNeuronHarness()
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gi-removal-')))
    project = join(root, 'ts-app')
    cpSync(join(REPRISE_FIXTURES, 'ts-app'), project, { recursive: true })
    mkdirSync(join(root, 'profil'))
    conversations = new ConversationRepository(t.handle.db)
    reprise = new RepriseRepository(t.handle.db)
    history = new HistoryService(new HistoryRepository(t.handle.db))
    service = new RepriseService({
      repository: reprise,
      pickFolder: async () => project,
      scan: (folder) => scanProject(folder),
      linkedFolders: () => conversations.linkedFolders(),
      createGenesis: async (title) => (await t.neurons.create({ text: title })).id,
      attach: (neuronId, dir) => conversations.setProjectDir(neuronId, dir, randomUUID()),
      dataDir: join(root, 'profil'),
      isArchived: (genesisId) => conversations.neuron(genesisId)?.state === 'archived'
    })
  })
  afterEach(() => {
    t.dispose()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_unlink_the_folder_when_the_idea_is_removed_and_link_it_again_on_undo', async () => {
    const idea = (await t.neurons.create({ text: 'Projet lié' })).id
    conversations.setProjectDir(idea, project, 'session')
    const { batchId } = t.neurons.remove(idea)
    expect(conversations.neuron(idea)).toMatchObject({ state: 'archived', projectDir: null })
    expect(conversations.linkedFolders()).toEqual([])
    history.undo(batchId)
    expect(conversations.neuron(idea)?.projectDir).toBe(project)
    expect(conversations.neuron(idea)?.state).not.toBe('archived')
  })

  it('should_import_the_folder_again_once_its_reprise_genesis_is_removed', async () => {
    const first = await service.create((await service.previewFolder())?.previewId ?? '', 'local')
    reprise.setOverride(first.genesisId, 'category:src/a.ts#A', 'domain')
    expect((await service.previewFolder())?.alreadyLinked).toBe(first.genesisId)
    t.neurons.remove(first.genesisId)
    const preview = await service.previewFolder()
    expect(preview?.alreadyLinked).toBeNull()
    const second = await service.create(preview?.previewId ?? '', 'claude')
    expect(second.genesisId).not.toBe(first.genesisId)
    expect(reprise.project(first.genesisId)).toBeUndefined()
    expect(reprise.overrides(first.genesisId).size).toBe(0)
    expect(reprise.project(second.genesisId)).toMatchObject({ rootDir: project, confidentiality: 'claude' })
  })
})
