import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BrainstormScope } from '../../../src/main/application/brainstorms/BrainstormScope'
import { BrainstormService } from '../../../src/main/application/brainstorms/BrainstormService'
import { migrateLegacyCanvas } from '../../../src/main/application/brainstorms/LegacyCanvasMigration'
import { AppError } from '../../../src/main/domain/errors'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { BlockRepository } from '../../../src/main/infrastructure/db/repositories/BlockRepository'
import { BrainstormRepository } from '../../../src/main/infrastructure/db/repositories/BrainstormRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { EMPTY_VIEW_STATE } from '../../../src/shared/brainstorms/viewState'
import { buildVault } from '../../support/vault'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

describe('Project Manager : brainstorms (spec 024 US1, US3)', () => {
  let dir: string
  let handle: DatabaseHandle
  let repository: BrainstormRepository
  let scope: BrainstormScope
  let neurons: NeuronRepository
  let blocks: BlockRepository
  let root: string | null
  let attached: Map<string, string>
  let projectsCreate: (slug: string) => { folder: string }

  const service = (git: { files: number; ahead: number; behind: number } | null = null): BrainstormService =>
    new BrainstormService({
      repository,
      scope,
      projectsRoot: () => root,
      dataDir: join(dir, 'profil'),
      createGenesis: (title, content, brainstormId) => {
        const id = randomUUID()
        neurons.insertRoot({ id, title, content, nature: 'reflection', natureSource: null, brainstormId })
        return id
      },
      attach: (neuronId, folder) => attached.set(neuronId, folder),
      discardGenesis: (neuronId) => repository.discardFreshRoot(neuronId),
      gitState: async () => git,
      projects: {
        create: async ({ slug }) => projectsCreate(slug),
        initGit: async () => ({ ok: true })
      },
      now: () => new Date('2026-10-10T08:00:00Z')
    })

  const idea = (title: string): string => {
    const id = randomUUID()
    neurons.insertRoot({ id, title, content: null, nature: 'reflection', natureSource: null })
    return id
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-brainstorms-'))
    mkdirSync(join(dir, 'profil'))
    handle = openDatabase({ file: join(dir, 'g.db'), key: '7'.repeat(64), migrationsFolder: MIGRATIONS })
    repository = new BrainstormRepository(handle.db)
    scope = new BrainstormScope(() => repository.ensureLoose())
    neurons = new NeuronRepository(handle.db, scope)
    blocks = new BlockRepository(handle.db, scope)
    root = buildVault(
      join(dir, 'coffre'),
      [
        { slug: 'alpha', name: 'Alpha', journal: ['[2026-10-01] FEAT — un', '[2026-10-02] FIX — deux'] },
        { slug: 'beta', name: 'Beta' }
      ],
      { slug: 'beta', openedAt: '2026-10-09T10:00:00Z' }
    )
    attached = new Map()
    projectsCreate = (slug) => {
      mkdirSync(join(root ?? '', slug, 'docs'), { recursive: true })
      return { folder: slug }
    }
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_list_the_vault_projects_and_mark_the_open_session_when_nothing_was_opened_yet', () => {
    const items = service().list()
    expect(items.map((item) => [item.slug, item.id, item.openSession, item.folderMissing]).sort()).toEqual([
      ['alpha', null, false, false],
      ['beta', null, true, false]
    ])
  })

  it('should_create_the_brainstorm_of_a_registry_project_on_first_open_and_show_only_its_canvas', async () => {
    const loose = idea('idée hors projet')
    const opened = await service({ files: 2, ahead: 1, behind: 0 }).open({ slug: 'alpha' })
    expect(opened.brainstorm.name).toBe('Alpha')
    expect(opened.brainstorm.genesisId).not.toBeNull()
    expect(attached.get(opened.brainstorm.genesisId ?? '')).toContain('alpha')
    expect(opened.journal).toEqual(['[2026-10-02] FIX — deux', '[2026-10-01] FEAT — un'])
    expect(opened.anomalies).toEqual([
      { kind: 'session_elsewhere', slug: 'beta', since: '2026-10-09T10:00:00Z' },
      { kind: 'uncommitted', count: 2 },
      { kind: 'unpushed', count: 1 }
    ])
    // Seul le genesis d'Alpha est sur la carte ; l'idée née sans brainstorm est dans « Idées en vrac ».
    expect(neurons.canvasRoots().map((root) => root.title)).toEqual(['Alpha'])
    expect(neurons.canvasRoots().some((root) => root.id === loose)).toBe(false)
    // Rouvrir ne recrée rien : la liste montre le brainstorm de l'app, marqué « Reprendre ».
    const again = await service().open({ slug: 'alpha' })
    expect(again.brainstorm.id).toBe(opened.brainstorm.id)
    const items = service().list()
    expect(items.find((item) => item.slug === 'alpha')).toMatchObject({ id: opened.brainstorm.id, last: true })
    expect(items.filter((item) => item.slug === 'alpha')).toHaveLength(1)
    expect(items.some((item) => item.slug === 'idees-en-vrac')).toBe(true)
  })

  it('should_keep_blocks_and_new_ideas_in_the_active_brainstorm_only', async () => {
    const alpha = await service().open({ slug: 'alpha' })
    blocks.insert({ kind: 'label', x: 0, y: 0, width: 200, height: 80, text: 'note alpha' })
    idea('idée alpha')
    const beta = await service().open({ slug: 'beta' })
    expect(neurons.canvasRoots().map((root) => root.title)).toEqual(['Beta'])
    expect(blocks.list()).toEqual([])
    await service().open({ id: alpha.brainstorm.id })
    expect(neurons.canvasRoots().map((root) => root.title)).toEqual(['Alpha', 'idée alpha'])
    expect(blocks.list().map((block) => block.text)).toEqual(['note alpha'])
    service().close()
    expect(neurons.canvasRoots()).toEqual([])
    expect(beta.brainstorm.id).not.toBe(alpha.brainstorm.id)
  })

  it('should_save_and_restore_the_view_state', async () => {
    const opened = await service().open({ slug: 'alpha' })
    expect(opened.viewState).toBeNull()
    const state = {
      ...EMPTY_VIEW_STATE,
      viewport: { x: 12, y: -40, zoom: 0.8 },
      structureViews: { [opened.brainstorm.genesisId ?? '']: 'workflow' as const },
      openCards: [{ id: 'carte', offset: { x: 1, y: 2 }, sheet: true, side: 'chat' as const, pinned: true }]
    }
    service().saveViewState(opened.brainstorm.id, state)
    expect((await service().open({ id: opened.brainstorm.id })).viewState).toEqual(state)
  })

  it('should_refuse_a_missing_folder_and_an_unknown_brainstorm', async () => {
    rmSync(join(root ?? '', 'beta'), { recursive: true })
    expect(
      service()
        .list()
        .find((item) => item.slug === 'beta')?.folderMissing
    ).toBe(true)
    await expect(service().open({ slug: 'beta' })).rejects.toMatchObject({ code: 'FOLDER_MISSING' })
    await expect(service().open({ id: randomUUID() })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('should_create_a_project_from_scratch_in_the_vault_with_its_genesis', async () => {
    const created = await service().createScratch({
      name: 'Essai local',
      slug: 'essai-local',
      description: 'Un essai',
      type: 'Web App',
      github: false
    })
    expect(created.warning).toBeNull()
    const row = repository.get(created.id)
    expect(row).toMatchObject({ slug: 'essai-local', location: 'vault', origin: 'scratch', gitRole: 'owner' })
    expect(row?.folderPath).toContain('essai-local')
    const opened = await service().open({ id: created.id })
    expect(neurons.canvasRoots().map((root) => [root.title, root.id])).toEqual([
      ['Essai local', opened.brainstorm.genesisId]
    ])
  })

  it('should_refuse_github_an_invalid_name_or_a_taken_name_before_writing_anything', async () => {
    const base = { name: 'X', description: '', type: 'Web App' as const }
    await expect(service().createScratch({ ...base, slug: 'essai', github: true })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(service().createScratch({ ...base, slug: 'Pas bon', github: false })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(service().createScratch({ ...base, slug: 'alpha', github: false })).rejects.toMatchObject({
      code: 'CONFLICT'
    })
    root = null
    await expect(service().createScratch({ ...base, slug: 'essai', github: false })).rejects.toMatchObject({
      code: 'NO_ROOT'
    })
    expect(repository.list()).toEqual([])
  })

  it('should_remove_the_brainstorm_and_its_genesis_when_the_folder_cannot_be_created', async () => {
    projectsCreate = () => {
      throw new AppError('CONFLICT', 'Le dossier existe déjà.')
    }
    await expect(
      service().createScratch({ name: 'Raté', slug: 'rate', description: '', type: 'Web App', github: false })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(repository.list()).toEqual([])
    expect(repository.orphanRoots()).toEqual([])
  })

  it('should_move_the_single_legacy_map_into_brainstorms_without_losing_anything', () => {
    // Carte d'avant la spec 024 : dépôts sans portée (aucun brainstorm_id).
    const legacy = new NeuronRepository(handle.db)
    const legacyBlocks = new BlockRepository(handle.db)
    const linked = randomUUID()
    legacy.insertRoot({ id: linked, title: 'Projet lié', content: null, nature: 'action', natureSource: null })
    handle.db.run(sql`UPDATE neurons SET project_dir = ${join(root ?? '', 'alpha')} WHERE id = ${linked}`)
    for (const title of ['libre 1', 'libre 2'])
      legacy.insertRoot({ id: randomUUID(), title, content: null, nature: 'reflection', natureSource: null })
    legacyBlocks.insert({ kind: 'label', x: 0, y: 0, width: 200, height: 80, text: 'note' })
    const before = legacy.canvasRoots().length

    expect(migrateLegacyCanvas({ repository, projectsRoot: () => root })).toEqual({
      linked: 1,
      loose: 2,
      blocks: 1,
      created: 1
    })
    expect(migrateLegacyCanvas({ repository, projectsRoot: () => root })).toEqual({
      linked: 0,
      loose: 0,
      blocks: 0,
      created: 0
    })
    expect(legacy.canvasRoots()).toHaveLength(before)
    const alpha = repository.bySlug('alpha')
    expect(alpha).toMatchObject({ location: 'vault', origin: 'migrated' })
    expect(repository.genesisOf(alpha?.id ?? '')).toBe(linked)
    expect(readdirSync(root ?? '').sort()).toEqual(['alpha', 'beta'])
    expect(existsSync(join(root ?? '', 'idees-en-vrac'))).toBe(false)
  })
})
