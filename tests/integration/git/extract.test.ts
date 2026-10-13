import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { ExtractService } from '../../../src/main/application/git/ExtractService'
import { GitAccess } from '../../../src/main/application/git/GitAccess'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { buildScenario, commit } from '../../support/gitRepos'

const root = mkdtempSync(join(tmpdir(), 'gi-extract-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })
/** Workspace ProjectMaster fictif : `.hub/registry.json`, `projects/`, `snippets/`, `techno/`. */
const workspace = join(root, 'ProjectsMaster')
for (const dir of ['.hub', 'projects', 'snippets', 'techno/react']) mkdirSync(join(workspace, dir), { recursive: true })
writeFileSync(join(workspace, '.hub', 'registry.json'), '{"projects":{}}\n')
const repos = buildScenario(join(root, 'depots'), 'licences')

function harness(dir: string, projectsRoot: string | null = join(workspace, 'projects')) {
  const runner = new GitRunner({ emptyHooksDir: join(dataDir, 'git-empty-hooks') })
  const operations: { kind: string; status: string; errorCode?: string }[] = []
  return {
    operations,
    service: new ExtractService({
      access: new GitAccess({
        locator: new RepoLocator({ projectDir: () => dir, isTrusted: () => false, runner, dataDir }),
        runner,
        repository: { openMergeHead: () => null }
      }),
      repository: {
        repo: () => ({
          genesisId: 'g',
          defaultRemote: null,
          remoteUrl: null,
          githubRepo: 'compte/projet',
          upstreamRepo: null,
          lastFetchAt: null,
          lastSeenCommit: null,
          mappedCommit: null,
          sensitiveCheckedHead: null,
          cloned: true
        }),
        logOperation: (input) => {
          operations.push({
            kind: input.kind,
            status: input.status,
            ...(input.errorCode === undefined || input.errorCode === null ? {} : { errorCode: input.errorCode })
          })
          return 'id'
        }
      },
      projectsRoot: () => projectsRoot,
      now: () => new Date('2026-10-13T10:00:00.000Z')
    })
  }
}

describe('extraire un morceau d’un projet open source (spec 021 US7)', { timeout: 60_000 }, () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_show_the_license_before_copying_and_write_the_file_with_its_attribution', async () => {
    const dir = join(repos, 'mit')
    commit(
      dir,
      { 'src/outil.ts': 'export const un = 1\nexport const deux = 2\nexport const trois = 3\n' },
      'feat: outil'
    )
    const { service, operations } = harness(dir)
    const preview = await service.preview('g', 'src/outil.ts', { from: 2, to: 3 })
    expect(preview.license).toMatchObject({ spdx: 'MIT', verdict: 'permise' })
    expect(preview.studyNoteOnly).toBe(false)
    expect(preview.header).toContain('// Extrait de compte/projet — src/outil.ts, lignes 2 à 3')
    expect(preview.destinations).toEqual([
      { root: 'snippets', folders: [] },
      { root: 'techno', folders: ['react'] }
    ])
    const input = { genesisId: 'g', path: 'src/outil.ts', lines: { from: 2, to: 3 }, root: 'snippets' as const }
    expect(await service.extract({ ...input, folder: 'outils', fileName: 'outil.ts', mode: 'copy' })).toEqual({
      written: 'snippets/outils/outil.ts'
    })
    const written = readFileSync(join(workspace, 'snippets', 'outils', 'outil.ts'), 'utf8')
    expect(written).toContain('// Copyright (c) 2026 Auteur Fictif')
    expect(written).toContain('export const deux = 2\nexport const trois = 3')
    expect(written).not.toContain('export const un')
    // Jamais d'écrasement.
    await expect(
      service.extract({ ...input, folder: 'outils', fileName: 'outil.ts', mode: 'copy' })
    ).rejects.toMatchObject({
      code: 'NAME_TAKEN'
    })
    expect(operations.map((entry) => entry.status)).toEqual(['ok', 'failed'])
  })

  it('should_offer_only_a_study_note_without_license_and_never_copy_the_code', async () => {
    const dir = join(repos, 'sans-licence')
    const { service } = harness(dir)
    const preview = await service.preview('g', 'index.ts')
    expect(preview).toMatchObject({ license: { verdict: 'inconnue' }, studyNoteOnly: true, header: '' })
    const base = { genesisId: 'g', path: 'index.ts', root: 'techno' as const, folder: 'etudes' }
    await expect(service.extract({ ...base, fileName: 'index.ts', mode: 'copy' })).rejects.toMatchObject({
      code: 'LICENSE_FORBIDS_COPY'
    })
    await service.extract({ ...base, fileName: 'index.md', mode: 'study_note' })
    const note = readFileSync(join(workspace, 'techno', 'etudes', 'index.md'), 'utf8')
    expect(note).toContain('Note d’étude')
    expect(note).not.toContain('export {}')
  })

  it('should_refuse_a_destination_outside_the_workspace_folders_a_secret_and_a_missing_workspace', async () => {
    const dir = join(repos, 'gpl')
    writeFileSync(join(dir, '.env'), 'CLE=fictive\n')
    const { service } = harness(dir)
    expect((await service.preview('g', 'LICENSE')).license).toMatchObject({ spdx: 'GPL-3.0', verdict: 'reciprocite' })
    const base = { genesisId: 'g', path: 'LICENSE', root: 'snippets' as const, mode: 'study_note' as const }
    for (const folder of ['..', '../projects', 'a/b', '']) {
      await expect(service.extract({ ...base, folder, fileName: 'x.md' })).rejects.toMatchObject({
        code: 'DESTINATION_REFUSED'
      })
    }
    await expect(service.extract({ ...base, folder: 'ok', fileName: '../x.md' })).rejects.toMatchObject({
      code: 'DESTINATION_REFUSED'
    })
    await expect(service.preview('g', '.env')).rejects.toMatchObject({ code: 'SENSITIVE_FILE' })
    await expect(service.preview('g', '../mit/LICENSE')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(existsSync(join(workspace, 'x.md'))).toBe(false)
    await expect(harness(dir, null).service.preview('g', 'LICENSE')).rejects.toMatchObject({ code: 'NO_WORKSPACE' })
  })
})
