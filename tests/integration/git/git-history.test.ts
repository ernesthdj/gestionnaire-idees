import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { GitAccess } from '../../../src/main/application/git/GitAccess'
import { GitHistoryService } from '../../../src/main/application/git/GitHistoryService'
import { RepoLocator } from '../../../src/main/application/git/RepoLocator'
import { AUTHOR_PALETTE, pseudonyms } from '../../../src/main/domain/git/authors'
import { openDatabase } from '../../../src/main/infrastructure/db/client'
import { GitRepository } from '../../../src/main/infrastructure/db/repositories/GitRepository'
import { NeuronRepository } from '../../../src/main/infrastructure/db/repositories/NeuronRepository'
import { GitRunner } from '../../../src/main/infrastructure/git/GitRunner'
import { AUTHORS, buildScenario, git } from '../../support/gitRepos'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const root = mkdtempSync(join(tmpdir(), 'gi-git-history-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })

function harness(dir: string, localOnly = false) {
  const handle = openDatabase({
    file: join(root, `${randomUUID()}.db`),
    key: 'c'.repeat(64),
    migrationsFolder: MIGRATIONS
  })
  const genesisId = randomUUID()
  new NeuronRepository(handle.db).insertRoot({
    id: genesisId,
    title: 'P',
    content: null,
    nature: 'action',
    natureSource: null
  })
  const runner = new GitRunner({ emptyHooksDir: join(dataDir, 'git-empty-hooks') })
  const repository = new GitRepository(handle.db)
  const inputs: string[] = []
  const history = new GitHistoryService({
    access: new GitAccess({
      locator: new RepoLocator({ projectDir: () => dir, isTrusted: () => false, runner, dataDir }),
      runner,
      repository
    }),
    repository,
    authorSecret: () => 'secret-de-test',
    changed: () => undefined,
    localOnly: () => localOnly,
    story: async (input) => {
      inputs.push(input)
      return 'Auteur A a posé le projet, Auteur B a ajouté a.'
    }
  })
  return { genesisId, history, inputs, close: () => handle.close() }
}

/** Contraste WCAG entre deux couleurs hexadécimales. */
function contrast(a: string, b: string): number {
  const lum = (hex: string): number => {
    const [r, g, v] = [1, 3, 5]
      .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (v ?? 0)
  }
  const [high, low] = [lum(a), lum(b)].sort((x, y) => y - x)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

describe('qui a fait quoi et quand (spec 021 US5, lot 1)', { timeout: 60_000 }, () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_keep_every_author_color_readable_on_light_dark_and_carbon_backgrounds', () => {
    for (const color of AUTHOR_PALETTE) {
      for (const background of ['#ffffff', '#18181b', '#0d0d0f'])
        expect(contrast(color, background)).toBeGreaterThanOrEqual(3)
    }
    expect([...pseudonyms(['k1', 'k2', 'k1', 'k3']).values()]).toEqual(['Auteur A', 'Auteur B', 'Auteur C'])
  })

  it('should_show_one_line_per_author_and_merge_two_identities_of_the_same_person', async () => {
    const repo = buildScenario(join(root, 'trois'), 'trois-auteurs')
    const { genesisId, history, close } = harness(repo)
    const view = await history.history(genesisId, 0, 5_000)
    expect(view.commits).toHaveLength(4)
    // « Alice Fictive » et « A. Fictive » ont le même e-mail (casse près) : une seule personne.
    const names = view.authors.map((author) => author.name)
    expect(names).toEqual(expect.arrayContaining(['Bob Fictif', 'Chloé Fictive']))
    expect(names.filter((name) => name.includes('Fictive') && name !== 'Chloé Fictive')).toHaveLength(1)
    expect(view.authors).toHaveLength(3)
    const [bob, chloe] = ['Bob Fictif', 'Chloé Fictive'].map((name) =>
      view.authors.find((author) => author.name === name)
    )
    history.mergeAuthors(genesisId, chloe?.key ?? '', [bob?.key ?? ''])
    const merged = await history.history(genesisId, 0, 5_000)
    expect(merged.authors).toHaveLength(2)
    expect(merged.merged).toEqual([{ key: bob?.key, mainKey: chloe?.key, name: 'Bob Fictif' }])
    expect(merged.commits.filter((commit) => commit.authorKey === chloe?.key)).toHaveLength(2)
    history.unmergeAuthor(genesisId, bob?.key ?? '')
    expect((await history.history(genesisId, 0, 5_000)).authors).toHaveLength(3)
    expect(() => history.unmergeAuthor(genesisId, bob?.key ?? '')).toThrow(/n’existe plus/)
    close()
  })

  it('should_load_more_by_pages', async () => {
    const repo = buildScenario(join(root, 'pages'), 'trois-auteurs')
    const { genesisId, history, close } = harness(repo)
    const first = await history.history(genesisId, 0, 3)
    expect(first.commits.map((commit) => commit.subject)).toEqual(['fix: a', 'feat: b', 'feat: a'])
    expect(first.more).toBe(true)
    const next = await history.history(genesisId, 3, 3)
    expect(next.commits.map((commit) => commit.subject)).toEqual(['chore: départ'])
    expect(next.more).toBe(false)
    close()
  })

  it('should_tell_the_period_to_claude_with_pseudonyms_only', async () => {
    const repo = buildScenario(join(root, 'recit'), 'trois-auteurs')
    const { genesisId, history, inputs, close } = harness(repo)
    const commits = git(repo, ['log', '--format=%H']).trim().split('\n')
    const story = await history.story(genesisId, commits.at(-1) ?? '', commits[0] ?? '')
    expect(story.commits).toBe(4)
    expect(story.text).toContain('Auteur A')
    expect(Object.keys(story.names)).toEqual(['Auteur A', 'Auteur B', 'Auteur C'])
    // Aucun nom ni e-mail réel (fictif) ne part vers Claude (SC-004).
    for (const author of Object.values(AUTHORS)) {
      expect(inputs[0]).not.toContain(author.name)
      expect(inputs[0]?.toLowerCase()).not.toContain(author.email.toLowerCase())
    }
    expect(inputs[0]).toContain('chore: départ')
    const local = harness(repo, true)
    await expect(local.history.story(local.genesisId, commits.at(-1) ?? '', commits[0] ?? '')).rejects.toMatchObject({
      code: 'LOCAL_ONLY'
    })
    local.close()
    close()
  })
})
