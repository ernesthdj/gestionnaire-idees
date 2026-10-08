import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateService, type UpdateServiceDeps } from '../../../src/main/application/analyste/UpdateService'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AnalysteRepository } from '../../../src/main/infrastructure/db/repositories/AnalysteRepository'
import { runGit } from '../../../src/main/infrastructure/projects/GitCli'
import type { CheckRunner } from '../../../src/main/infrastructure/analyste/NpmCli'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const PROPOSAL = '7b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f'

describe('mises à jour de l’Analyste (spec 019 US4, T032–T034)', () => {
  let root: string
  let repo: string
  let handle: DatabaseHandle
  let store: AnalysteRepository
  let service: UpdateService
  let gitCalls: string[][]
  let sent: string[]
  let checksOk: boolean
  const checks = vi.fn<CheckRunner>(async () => ({ ok: checksOk, tail: checksOk ? '' : 'Erreur fictive de type.' }))

  const sh = async (args: string[]): Promise<string> => {
    const result = await runGit(repo, args)
    if (result.code !== 0) throw new Error(`git ${args.join(' ')} : ${result.output}`)
    return result.output
  }
  const make = (overrides: Partial<UpdateServiceDeps> = {}): UpdateService =>
    new UpdateService({
      store,
      repoPath: () => repo,
      git: (cwd, args, timeout) => {
        gitCalls.push([...args])
        return runGit(cwd, args, timeout)
      },
      checks,
      sendToConversation: async (_neuron, text) => void sent.push(text),
      emit: () => undefined,
      ...overrides
    })

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'analyste-update-'))
    repo = join(root, 'depot')
    mkdirSync(join(repo, 'src'), { recursive: true })
    mkdirSync(join(repo, 'node_modules', 'fictif'), { recursive: true })
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 1\n')
    writeFileSync(join(repo, 'package.json'), '{ "name": "fictif" }\n')
    writeFileSync(join(repo, '.gitignore'), 'node_modules/\n.analyste/\n')
    await sh(['init', '-q', '-b', 'main'])
    await sh(['config', 'user.name', 'Testeur fictif'])
    await sh(['config', 'user.email', 'testeur@exemple.invalid'])
    await sh(['add', '-A'])
    await sh(['commit', '-q', '-m', 'Départ fictif'])
    handle = openDatabase({ file: join(root, 'a.db'), key: '8'.repeat(64), migrationsFolder: MIGRATIONS })
    store = new AnalysteRepository(handle.db)
    store.startAnalysis({ id: 'a1', trigger: 'manual', windowFrom: 0, windowTo: 10, events: 1, startedAt: 1 })
    store.finishAnalysis('a1', 2, null, [
      {
        id: PROPOSAL,
        category: 'bug',
        title: 'Corriger la constante a',
        finding: 'La constante vaut 1.',
        proposal: 'La passer à 2.',
        gain: 'Exactitude.',
        risk: 'faible',
        severity: 2,
        confidence: 0.9,
        evidence: { observations: [], code: [{ path: 'src/a.ts', start: 1 }] },
        files: ['src/a.ts'],
        withoutEvidence: false,
        dedupeKey: 'k'
      }
    ])
    gitCalls = []
    sent = []
    checksOk = true
    checks.mockClear()
    service = make()
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  const waitStatus = async (updateId: string, status: string): Promise<void> =>
    vi.waitFor(() => expect(service.view(updateId).status).toBe(status), { timeout: 5_000 })

  it('should_refuse_a_dirty_repo_and_keep_the_acceptance_then_create_branch_copy_and_conversation', async () => {
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 3\n')
    await expect(service.start(PROPOSAL)).rejects.toMatchObject({ code: 'REPO_DIRTY' })
    expect(store.proposal(PROPOSAL)?.status).toBe('accepted')
    await sh(['checkout', '--', 'src/a.ts'])
    const update = await service.start(PROPOSAL)
    expect(update).toMatchObject({
      status: 'coding',
      branch: expect.stringMatching(/^analyste\/[0-9a-f]{8}-corriger-la-constante-a$/)
    })
    expect(existsSync(join(update.folder, 'src', 'a.ts'))).toBe(true)
    expect(existsSync(join(update.folder, 'node_modules', 'fictif'))).toBe(true)
    expect(store.proposal(PROPOSAL)?.status).toBe('coding')
    expect(sent[0]).toContain('<proposition>')
    expect(sent[0]).toContain('ne lance ni git commit, ni push')
    // Le dépôt ouvert reste sur main, intact.
    expect((await sh(['symbolic-ref', '--short', 'HEAD'])).trim()).toBe('main')
    await expect(service.start(PROPOSAL)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })

  it('should_limit_writes_of_the_coding_conversation_to_its_copy', async () => {
    const update = await service.start(PROPOSAL)
    const neuron = update.conversationNeuronId as string
    expect(service.guardWrite(neuron, join(update.folder, 'src', 'b.ts'))).toBeNull()
    expect(service.guardWrite(neuron, 'src/nouveau/c.ts')).toBeNull()
    expect(service.guardWrite(neuron, join(repo, 'src', 'a.ts'))).toContain('Écriture refusée')
    expect(service.guardWrite(neuron, join(update.folder, 'node_modules', 'fictif', 'x.js'))).toContain('refusée')
    expect(service.guardWrite(neuron, join(update.folder, '..', '..', '..', 'src', 'a.ts'))).toContain('refusée')
    // Une autre conversation n'est pas concernée.
    expect(service.guardWrite('9b1f0c1e-9a4b-4c3d-8e2f-0a1b2c3d4e5f', join(repo, 'x'))).toBeNull()
  })

  it('should_commit_with_a_proposal_trailer_and_run_checks_then_keep_by_a_no_ff_merge', async () => {
    const update = await service.start(PROPOSAL)
    await expect(service.finish(update.id)).rejects.toMatchObject({ code: 'NOTHING_CHANGED' })
    writeFileSync(join(update.folder, 'src', 'a.ts'), 'export const a = 2\n')
    checksOk = false
    await service.finish(update.id)
    await waitStatus(update.id, 'to_fix')
    expect(service.view(update.id).checks.typecheck).toEqual({ status: 'fail', tail: 'Erreur fictive de type.' })
    const message = (await runGit(update.folder, ['log', '-1', '--format=%B'])).output
    expect(message).toContain(`Analyste-Proposal: ${PROPOSAL}`)
    expect(message).not.toMatch(/co-authored-by/i)
    await expect(service.keep(update.id)).rejects.toMatchObject({ code: 'CHECKS_NOT_GREEN' })
    checksOk = true
    await service.finish(update.id)
    await waitStatus(update.id, 'ready')
    expect((await service.diff(update.id)).files).toEqual([{ path: 'src/a.ts', added: 1, removed: 1 }])
    expect(service.tryCommand(update.id)).toEqual({ command: 'npm run essai', folder: update.folder })
    const kept = await service.keep(update.id)
    expect(kept.status).toBe('kept')
    expect(store.proposal(PROPOSAL)?.status).toBe('kept')
    expect((await sh(['log', '-1', '--format=%P'])).trim().split(' ')).toHaveLength(2)
    expect(existsSync(update.folder)).toBe(false)
    expect((await sh(['branch', '--list', 'analyste/*'])).trim()).toBe('')
    // La fusion n'a pas touché node_modules du dépôt (la jonction a été retirée avant).
    expect(existsSync(join(repo, 'node_modules', 'fictif'))).toBe(true)
  })

  it('should_discard_only_the_copy_and_its_branch', async () => {
    const update = await service.start(PROPOSAL)
    writeFileSync(join(update.folder, 'src', 'a.ts'), 'export const a = 9\n')
    const discarded = await service.discard(update.id, 'Pas convaincant')
    expect(discarded.status).toBe('discarded')
    expect(existsSync(update.folder)).toBe(false)
    expect(existsSync(join(repo, 'node_modules', 'fictif'))).toBe(true)
    expect((await sh(['branch', '--list'])).trim()).toBe('* main')
    expect((await sh(['status', '--porcelain'])).trim()).toBe('')
    expect(store.proposal(PROPOSAL)?.status).toBe('discarded')
  })

  it('should_not_run_checks_when_dependencies_changed_and_show_what_to_do', async () => {
    const update = await service.start(PROPOSAL)
    writeFileSync(join(update.folder, 'package.json'), '{ "name": "fictif", "dependencies": { "x": "1.0.0" } }\n')
    await service.finish(update.id)
    await waitStatus(update.id, 'to_fix')
    const view = service.view(update.id)
    expect(view.depsChanged).toBe(true)
    expect(view.checks.typecheck.tail).toContain('npm ci')
    expect(checks).not.toHaveBeenCalled()
    expect(existsSync(join(update.folder, 'node_modules'))).toBe(false)
  })

  it('should_reconcile_an_interrupted_keep_from_git_at_startup', async () => {
    const update = await service.start(PROPOSAL)
    writeFileSync(join(update.folder, 'src', 'a.ts'), 'export const a = 2\n')
    await service.finish(update.id)
    await waitStatus(update.id, 'ready')
    // Fusion faite, puis l'app se recharge avant d'écrire « kept ».
    store.patchUpdate(update.id, { status: 'keeping' })
    await sh(['merge', '--no-ff', '-q', '-m', 'Fusion fictive', update.branch])
    await make().reconcile()
    expect(service.view(update.id).status).toBe('kept')
    expect(existsSync(update.folder)).toBe(false)
  })

  it('should_never_push_reset_rebase_or_force_a_branch_in_any_flow', async () => {
    const first = await service.start(PROPOSAL)
    writeFileSync(join(first.folder, 'src', 'a.ts'), 'export const a = 2\n')
    await service.finish(first.id)
    await waitStatus(first.id, 'ready')
    await service.keep(first.id)
    const forbidden = gitCalls.filter(
      (args) =>
        ['push', 'reset', 'rebase', 'filter-branch', 'update-ref'].includes(args[0] ?? '') ||
        args.includes('--amend') ||
        args.includes('--no-verify') ||
        (args.includes('--force') && args[0] !== 'worktree') ||
        (args[0] === 'branch' && args.includes('-f'))
    )
    expect(forbidden).toEqual([])
    // Seules des branches analyste/* sont supprimées.
    for (const args of gitCalls.filter((call) => call[0] === 'branch' && (call.includes('-d') || call.includes('-D'))))
      expect(args.at(-1)).toMatch(/^analyste\//)
  })
})
