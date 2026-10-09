import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectService, type ProjectDeps } from '../../../src/main/application/projects/ProjectService'
import type { ConversationNeuron } from '../../../src/main/infrastructure/db/repositories/ConversationRepository'
import type { GitResult } from '../../../src/main/infrastructure/projects/GitCli'

const GENESIS = '00000000-0000-4000-8000-000000000101'
const STEP = '00000000-0000-4000-8000-000000000102'

const neuronOf = (extra: Partial<ConversationNeuron>): ConversationNeuron =>
  ({
    id: GENESIS,
    rootId: GENESIS,
    kind: 'idea',
    title: 'Studio photo',
    projectDir: null,
    genesisId: null,
    ...extra
  }) as ConversationNeuron

const input = {
  neuronId: GENESIS,
  name: 'Studio "photo"',
  slug: 'studio-photo',
  type: 'Web App' as const,
  description: 'Un studio\nà Liège'
}

describe('genesis → projet (spec 016 US1, US2)', () => {
  let base: string
  let root: string
  let saved: string | null
  let neurons: Map<string, ConversationNeuron>
  const attach = vi.fn<(neuronId: string, dir: string) => void>()
  const git = vi.fn<(cwd: string, args: readonly string[], timeoutMs?: number, stdin?: string) => Promise<GitResult>>()
  const pickRoot = vi.fn<() => Promise<string | undefined>>()

  const service = (extra: Partial<ProjectDeps> = {}): ProjectService =>
    new ProjectService({
      settings: { projectsRoot: () => saved, saveProjectsRoot: (value) => (saved = value) },
      pickRoot,
      neuron: (id) => neurons.get(id),
      attach: (neuronId, dir) => {
        attach(neuronId, dir)
        const neuron = neurons.get(neuronId)
        if (neuron !== undefined) neurons.set(neuronId, { ...neuron, projectDir: dir })
      },
      git,
      now: () => new Date('2026-10-06T13:05:00.000Z'),
      ...extra
    })

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'gi-projects-'))
    root = join(base, 'projects')
    mkdirSync(root)
    saved = root
    neurons = new Map([
      [GENESIS, neuronOf({})],
      [STEP, neuronOf({ id: STEP, kind: 'step' })]
    ])
    attach.mockReset()
    git.mockReset()
    git.mockResolvedValue({ code: 0, output: '' })
    pickRoot.mockReset()
    pickRoot.mockResolvedValue(undefined)
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('should_create_the_project_folder_and_link_the_genesis_when_validated', async () => {
    const created = await service().create(input)
    const dir = join(root, 'studio-photo')
    expect(created).toEqual({ folder: 'studio-photo', registered: false })
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toContain('# CLAUDE.md — Studio ’photo’')
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toContain('Un studio à Liège')
    expect(existsSync(join(dir, 'docs', 'JOURNAL.md'))).toBe(true)
    expect(existsSync(join(dir, 'src'))).toBe(true)
    expect(existsSync(join(dir, '.git'))).toBe(false)
    expect(attach).toHaveBeenCalledWith(GENESIS, expect.stringContaining('studio-photo'))
  })

  it('should_ask_for_the_root_first_and_create_nothing_when_cancelled', async () => {
    saved = null
    expect(await service().create(input)).toBeNull()
    expect(pickRoot).toHaveBeenCalled()
    expect(attach).not.toHaveBeenCalled()
    pickRoot.mockResolvedValueOnce(root)
    expect(await service().create(input)).toMatchObject({ folder: 'studio-photo' })
    expect(saved).not.toBeNull()
  })

  it('should_refuse_an_existing_folder_a_bad_slug_a_linked_genesis_or_a_step', async () => {
    mkdirSync(join(root, 'studio-photo'))
    writeFileSync(join(root, 'studio-photo', 'a.txt'), 'x')
    await expect(service().create(input)).rejects.toThrow(/existe déjà/)
    await expect(service().create({ ...input, slug: '../hors' })).rejects.toThrow(/minuscules/)
    await expect(service().create({ ...input, neuronId: STEP })).rejects.toThrow(/genesis/)
    neurons.set(GENESIS, neuronOf({ projectDir: base }))
    await expect(service().create({ ...input, slug: 'autre' })).rejects.toThrow(/déjà un dossier/)
    expect(attach).not.toHaveBeenCalled()
  })

  it('should_register_the_project_in_a_projectmaster_workspace_in_the_launcher_format', async () => {
    mkdirSync(join(base, '.hub'))
    const registry = join(base, '.hub', 'registry.json')
    writeFileSync(registry, JSON.stringify({ version: '1.0', projects: { autre: { slug: 'autre' } } }, null, 2))
    expect(service().settings()).toEqual({ root, hub: true })
    expect(await service().create(input)).toMatchObject({ registered: true })
    const text = readFileSync(registry, 'utf8')
    const parsed = JSON.parse(text) as { projects: Record<string, Record<string, unknown>> }
    expect(parsed.projects['autre']).toEqual({ slug: 'autre' })
    expect(parsed.projects['studio-photo']).toMatchObject({
      name: 'Studio ’photo’',
      description: 'Un studio à Liège',
      type: 'Web App',
      folder: 'studio-photo',
      status: 'active'
    })
    // Le lanceur pm.bat découpe un bloc de projet jusqu'à la ligne «    } ».
    expect(text).toMatch(/\n {4}"studio-photo": \{\n[\s\S]*?\n {4}\}/)
  })

  it('should_create_nothing_when_the_slug_is_already_registered_or_the_registry_unreadable', async () => {
    mkdirSync(join(base, '.hub'))
    const registry = join(base, '.hub', 'registry.json')
    writeFileSync(registry, JSON.stringify({ projects: { 'studio-photo': {} } }))
    await expect(service().create(input)).rejects.toThrow(/déjà un projet/)
    writeFileSync(registry, '{ cassé')
    await expect(service().create(input)).rejects.toThrow(/illisible/)
    expect(readFileSync(registry, 'utf8')).toBe('{ cassé')
    expect(existsSync(join(root, 'studio-photo'))).toBe(false)
  })

  it('should_init_git_with_a_first_commit_and_set_the_branch_in_the_registry', async () => {
    mkdirSync(join(base, '.hub'))
    const registry = join(base, '.hub', 'registry.json')
    writeFileSync(registry, JSON.stringify({ projects: {} }))
    await service().create(input)
    await service().initGit(GENESIS)
    const dir = neurons.get(GENESIS)?.projectDir ?? ''
    expect(git.mock.calls.map((call) => call[1])).toEqual([
      ['init', '-b', 'main'],
      ['add', '--all'],
      ['commit', '-F', '-']
    ])
    // Le message passe par l'entrée standard, jamais en argument (spec 021 T008, constitution I).
    expect(git.mock.calls[2]?.[3]).toBe('chore(studio-photo): initial scaffolding via Brainstormer')
    expect(git.mock.calls.every((call) => call[0] === dir)).toBe(true)
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('.env')
    const parsed = JSON.parse(readFileSync(registry, 'utf8')) as {
      projects: Record<string, Record<string, unknown>>
    }
    expect(parsed.projects['studio-photo']?.['branch']).toBe('main')
  })

  it('should_explain_why_git_failed', async () => {
    await expect(service().initGit(GENESIS)).rejects.toThrow(/pas de dossier/)
    await service().create(input)
    git.mockResolvedValueOnce({ code: null, output: '' })
    await expect(service().initGit(GENESIS)).rejects.toThrow(/git est introuvable/)
    git
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 0, output: '' })
      .mockResolvedValueOnce({ code: 128, output: 'Author identity unknown\n*** Please tell me who you are.' })
    await expect(service().initGit(GENESIS)).rejects.toThrow(/identité git/)
    mkdirSync(join(neurons.get(GENESIS)?.projectDir ?? '', '.git'))
    await expect(service().initGit(GENESIS)).rejects.toThrow(/déjà un dépôt/)
  })
})
