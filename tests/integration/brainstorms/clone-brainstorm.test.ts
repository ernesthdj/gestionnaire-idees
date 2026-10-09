import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BrainstormScope } from '../../../src/main/application/brainstorms/BrainstormScope'
import { CloneBrainstormService } from '../../../src/main/application/brainstorms/CloneBrainstormService'
import type { CloneRequest, CloneResult } from '../../../src/main/application/reprise/CloneService'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { BrainstormRepository } from '../../../src/main/infrastructure/db/repositories/BrainstormRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import type { BrainstormCloneProgress } from '../../../src/shared/ipc/brainstorms'
import { buildVault } from '../../support/vault'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const URL = 'https://jeton-fictif@github.com/compte-fictif/recettes.git'
const DISPLAY = 'https://github.com/compte-fictif/recettes.git'

describe('nouveau brainstorm depuis un lien Git (spec 024 US5)', () => {
  let dir: string
  let handle: DatabaseHandle
  let repository: BrainstormRepository
  let neurons: NeuronRepository
  let root: string | null
  let requests: CloneRequest[]
  let outcome: (request: CloneRequest) => CloneResult
  let progress: BrainstormCloneProgress[]
  let attached: Map<string, string>
  let large: number[]
  let cloned: { genesisId: string; dir: string; commit: string | null; display: string; confidentiality: string }[]

  const service = (): CloneBrainstormService =>
    new CloneBrainstormService({
      repository,
      projectsRoot: () => root,
      clone: async (request) => {
        requests.push(request)
        request.onProgress?.({ phase: 'reception', percent: 50 })
        return outcome(request)
      },
      createGenesis: (title, content, brainstormId) => {
        const id = randomUUID()
        neurons.insertRoot({ id, title, content, nature: 'reflection', natureSource: null, brainstormId })
        return id
      },
      attach: (neuronId, folder) => attached.set(neuronId, folder),
      emit: (event) => progress.push(event),
      emitLarge: (bytes) => large.push(bytes),
      onCloned: (event) => cloned.push(event),
      now: () => new Date('2026-10-10T11:00:00Z')
    })
  const input = {
    url: URL,
    name: 'Recettes',
    slug: 'recettes',
    type: 'Web App' as const,
    full: false,
    confidentiality: 'local' as const
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-clone-brainstorm-'))
    handle = openDatabase({ file: join(dir, 'g.db'), key: 'a'.repeat(64), migrationsFolder: MIGRATIONS })
    repository = new BrainstormRepository(handle.db)
    neurons = new NeuronRepository(handle.db, new BrainstormScope(() => repository.ensureLoose()))
    root = buildVault(join(dir, 'coffre'), [{ slug: 'alpha', name: 'Alpha' }])
    requests = []
    progress = []
    attached = new Map()
    large = []
    cloned = []
    outcome = (request) => {
      mkdirSync(request.target ?? '', { recursive: true })
      writeFileSync(join(request.target ?? '', 'README.md'), '# fictif\n')
      return { ok: true, dir: request.target ?? '', commit: 'a'.repeat(40), display: DISPLAY }
    }
  })
  afterEach(() => {
    handle.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should_clone_into_the_vault_register_the_project_and_never_keep_the_credentials', async () => {
    const { id } = await service().clone(input)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ url: URL, profile: 'historique', full: false })
    expect(requests[0]?.target).toBe(join(root ?? '', 'recettes'))
    expect(progress).toEqual([{ phase: 'reception', percent: 50 }])
    const row = repository.get(id)
    expect(row).toMatchObject({
      location: 'vault',
      origin: 'clone',
      gitRole: 'collaborator',
      description: `Cloné depuis ${DISPLAY}`
    })
    expect([...attached.values()]).toEqual([row?.folderPath])
    const registry = readFileSync(join(dir, 'coffre', '.hub', 'registry.json'), 'utf8')
    expect(JSON.parse(registry).projects.recettes).toMatchObject({
      name: 'Recettes',
      folder: 'recettes',
      type: 'Web App'
    })
    // L'identifiant du lien n'est écrit nulle part.
    expect(registry).not.toContain('jeton-fictif')
    expect(JSON.stringify(repository.list())).not.toContain('jeton-fictif')
    // Après le clone : dépôt « cloné », projet repris avec la confidentialité choisie (spec 021 US3).
    expect(cloned).toEqual([
      {
        genesisId: [...attached.keys()][0],
        dir: row?.folderPath,
        commit: 'a'.repeat(40),
        display: DISPLAY,
        confidentiality: 'local'
      }
    ])
    expect(large).toEqual([])
  })

  it('should_ask_once_to_continue_after_500_mb_received', async () => {
    const big = 600 * 1024 * 1024
    const clones = new CloneBrainstormService({
      repository,
      projectsRoot: () => root,
      clone: async (request) => {
        request.onProgress?.({ phase: 'reception', receivedBytes: big })
        request.onProgress?.({ phase: 'reception', receivedBytes: big + 1 })
        return outcome(request)
      },
      createGenesis: () => randomUUID(),
      attach: () => undefined,
      emit: () => undefined,
      emitLarge: (bytes) => large.push(bytes),
      onCloned: () => undefined
    })
    await clones.clone(input)
    expect(large).toEqual([big])
  })

  it('should_refuse_before_cloning_a_taken_name_an_invalid_one_or_a_missing_vault', async () => {
    await expect(service().clone({ ...input, slug: 'alpha' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(service().clone({ ...input, slug: 'Pas Bon' })).rejects.toMatchObject({ code: 'VALIDATION' })
    root = null
    await expect(service().clone(input)).rejects.toMatchObject({ code: 'NO_ROOT' })
    expect(requests).toEqual([])
  })

  it('should_explain_a_failed_clone_and_create_nothing', async () => {
    outcome = () => ({ ok: false, code: 'AUTH_FAILED', display: DISPLAY })
    await expect(service().clone(input)).rejects.toMatchObject({ code: 'CLONE_AUTH_FAILED', message: /Accès refusé/ })
    expect(repository.list()).toEqual([])
    expect(
      JSON.parse(readFileSync(join(dir, 'coffre', '.hub', 'registry.json'), 'utf8')).projects.recettes
    ).toBeUndefined()
  })

  it('should_cancel_the_running_clone', async () => {
    let release: () => void = () => undefined
    const clones = new CloneBrainstormService({
      repository,
      projectsRoot: () => root,
      clone: (request) =>
        new Promise<CloneResult>((done) => {
          release = () => done({ ok: false, code: 'CANCELLED', display: DISPLAY })
          request.signal?.addEventListener('abort', () => release())
        }),
      createGenesis: () => randomUUID(),
      attach: () => undefined,
      emit: () => undefined,
      emitLarge: () => undefined,
      onCloned: () => undefined
    })
    const running = clones.clone(input)
    await expect(clones.clone({ ...input, slug: 'autre' })).rejects.toMatchObject({ code: 'BUSY' })
    expect(clones.cancel()).toEqual({ ok: true })
    await expect(running).rejects.toMatchObject({ code: 'CLONE_CANCELLED' })
    expect(clones.cancel()).toEqual({ ok: false })
  })
})
