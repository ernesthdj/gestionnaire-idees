import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { ExtractService } from '../../../src/main/application/git/ExtractService'
import { GitAccess } from '../../../src/main/application/git/GitAccess'
import { GitHistoryService } from '../../../src/main/application/git/GitHistoryService'
import { GitHubService } from '../../../src/main/application/git/GitHubService'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { openDatabase } from '../../../src/main/infrastructure/db/client'
import { GitRepository } from '../../../src/main/infrastructure/db/repositories/GitRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { GitWriteQueue } from '../../../src/main/infrastructure/git/GitWriteQueue'
import { runProcess, type ProcessResult } from '../../../src/main/infrastructure/process/ProcessRunner'
import { AUTHORS, FAKE_TOKEN, bareWithClone, commit, git } from '../../support/gitRepos'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const root = mkdtempSync(join(tmpdir(), 'gi-git-audit-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })

/** Options et sous-commandes que l'app ne doit jamais lancer (SC-002). */
const FORBIDDEN = [
  '--force',
  '--force-with-lease',
  '--no-verify',
  '--amend',
  '--mirror',
  '--all',
  '--delete',
  'rebase',
  'reset',
  'clean',
  'filter-branch',
  'update-ref'
]

const ok = (stdout: string): ProcessResult => ({
  code: 0,
  stdout,
  stderr: '',
  truncated: false,
  timedOut: false,
  spawnFailed: false
})

describe('audit de bout en bout des parcours git (spec 021 T056 : SC-002, SC-004)', { timeout: 60_000 }, () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_launch_no_forbidden_command_and_store_no_token_url_credential_or_author_identity', async () => {
    // Un dépôt de travail qui suit un distant local ; une adresse avec jeton fictif tentée en remote secondaire.
    const { work } = bareWithClone(join(root, 'audit'))
    commit(work, { 'src/a.ts': 'export const a = 1\n', LICENSE: 'MIT License\n' }, 'feat: a', AUTHORS.bob)
    git(work, ['push', '-q'])
    git(work, ['config', 'remote.origin.partialclonefilter', 'blob:none'])

    const commands: string[][] = []
    const runner = new GitRunner({
      emptyHooksDir: join(dataDir, 'git-empty-hooks'),
      allowLocalTransportForTests: true,
      run: (request) => {
        commands.push([...request.args])
        return runProcess(request)
      }
    })
    const handle = openDatabase({ file: join(root, 'audit.db'), key: 'd'.repeat(64), migrationsFolder: MIGRATIONS })
    const genesisId = randomUUID()
    new NeuronRepository(handle.db).insertRoot({
      id: genesisId,
      title: 'Projet fictif',
      content: null,
      nature: 'action',
      natureSource: null
    })
    const repository = new GitRepository(handle.db)
    const access = new GitAccess({
      locator: new RepoLocator({ projectDir: () => work, isTrusted: () => false, runner, dataDir }),
      runner,
      repository
    })
    const aiInputs: string[] = []
    const history = new GitHistoryService({
      access,
      repository,
      authorSecret: () => 'secret-audit',
      changed: () => undefined,
      localOnly: () => false,
      story: async (input) => {
        aiInputs.push(input)
        return 'Auteur A a ajouté a.'
      },
      tree: () => ({
        has: (key) => key === 'd:src' || key === 'm:app',
        parent: (key) => (key === 'd:src' ? 'm:app' : '')
      })
    })
    const gh = {
      status: async () => ({ installed: true, login: 'moi' }),
      run: async (): Promise<ProcessResult> => ok('[]')
    }
    const github = new GitHubService({
      access,
      queue: new GitWriteQueue(),
      gh,
      repository,
      authorSecret: () => 'secret-audit',
      localOnly: () => false,
      neuron: () => ({ title: 'Idée', content: null }),
      changed: () => undefined,
      prText: async (input) => {
        aiInputs.push(input)
        return { title: 'feat: a', body: 'Texte' }
      },
      prReview: async () => null,
      issueText: async () => null
    })
    const workspace = join(root, 'ProjectsMaster')
    for (const dir of ['.hub', 'projects', 'snippets']) mkdirSync(join(workspace, dir), { recursive: true })
    writeFileSync(join(workspace, '.hub', 'registry.json'), '{}\n')
    const extract = new ExtractService({ access, repository, projectsRoot: () => join(workspace, 'projects') })

    // Parcours : rediffusion (clone partiel), « Tout télécharger », texte de PR, récit, branche de PR, extraction.
    const steps = await history.replaySteps(genesisId)
    await history.replay(genesisId, steps.commits.at(-1)?.hash ?? '', ['d:src'])
    await history.fetchAll(genesisId)
    git(work, ['switch', '-q', '-c', 'essai'])
    commit(work, { 'src/b.ts': 'export const b = 2\n' }, 'feat: b', AUTHORS.chloe)
    await github.prPropose(genesisId, 'main')
    const all = git(work, ['log', '--format=%H']).trim().split('\n')
    await history.story(genesisId, all.at(-1) ?? '', all[0] ?? '')
    await expect(github.prFetchBranch(genesisId, 1)).rejects.toMatchObject({ code: 'GIT_FAILED' })
    await extract.extract({
      genesisId,
      path: 'src/a.ts',
      root: 'snippets',
      folder: 'audit',
      fileName: 'a.ts',
      mode: 'copy'
    })
    // Une adresse avec identifiant n'est jamais enregistrée (FR-016).
    expect(() => repository.saveRepo(genesisId, { remoteUrl: `https://x:${FAKE_TOKEN}@github.com/a/b.git` })).toThrow()

    // SC-002 : aucune commande interdite parmi toutes celles lancées.
    expect(commands.length).toBeGreaterThan(10)
    for (const args of commands) {
      const separator = args.indexOf('--')
      const options = separator < 0 ? args : args.slice(0, separator)
      for (const token of FORBIDDEN) expect(options, args.join(' ')).not.toContain(token)
    }
    expect(commands.some((args) => args.includes('--refetch'))).toBe(true)

    // SC-004 : la base ne garde ni jeton, ni nom, ni e-mail d'auteur ; Claude ne reçoit que des pseudonymes.
    const dump = JSON.stringify([
      repository.repo(genesisId),
      repository.operations(genesisId),
      repository.issueLinks(genesisId)
    ])
    for (const author of Object.values(AUTHORS)) {
      expect(dump).not.toContain(author.name)
      expect(dump.toLowerCase()).not.toContain(author.email.toLowerCase())
      for (const input of aiInputs) {
        expect(input).not.toContain(author.name)
        expect(input.toLowerCase()).not.toContain(author.email.toLowerCase())
      }
    }
    expect(dump).not.toContain(FAKE_TOKEN)
    expect(aiInputs.join('\n')).toContain('Auteur A')
    handle.close()
  })
})
