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
import type { NodeTree } from '../../../src/main/domain/git/fileToNode'
import { AUTHORS, bareWithClone, buildScenario, commit, git } from '../../support/gitRepos'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')
const root = mkdtempSync(join(tmpdir(), 'gi-git-history-'))
const dataDir = join(root, 'profil')
mkdirSync(dataDir, { recursive: true })

/** Cartographie fictive du scénario `trois-auteurs` : un module `app`, son dossier `src` et ses fichiers. */
const TREE: NodeTree = (() => {
  const parents = new Map<string, string>([
    ['m:app', ''],
    ['d:src', 'm:app'],
    ['f:src/a.ts', 'd:src'],
    ['f:src/b.ts', 'd:src'],
    ['f:README.md', 'm:app']
  ])
  return { has: (key) => parents.has(key), parent: (key) => parents.get(key) ?? null }
})()

function harness(dir: string, localOnly = false, tree: NodeTree | null = TREE) {
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
  const runner = new GitRunner({ emptyHooksDir: join(dataDir, 'git-empty-hooks'), allowLocalTransportForTests: true })
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
    },
    tree: () => tree
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

  it('should_replay_who_touched_each_visible_node_up_to_a_commit_by_lines', async () => {
    const repo = buildScenario(join(root, 'rediffusion'), 'trois-auteurs')
    const { genesisId, history, close } = harness(repo)
    const steps = await history.replaySteps(genesisId)
    expect(steps.weight).toBe('lines')
    expect(steps.more).toBe(false)
    expect(steps.authors).toHaveLength(3)
    const [depart, featA, , fixA] = steps.commits
    const nameOf = (key: string | undefined): string | undefined =>
      steps.authors.find((author) => author.key === key)?.name
    expect(nameOf(depart?.authorKey)).toMatch(/Fictive/)
    // Après « feat: a » : `src` est à Bob, le README posé à la racine du module à Alice.
    const early = await history.replay(genesisId, featA?.hash ?? '', ['d:src', 'r:m:app'])
    expect(early.nodes.find((node) => node.key === 'd:src')).toMatchObject({ shares: [{ percent: 100 }] })
    expect(nameOf(early.nodes.find((node) => node.key === 'd:src')?.main)).toBe('Bob Fictif')
    expect(nameOf(early.nodes.find((node) => node.key === 'r:m:app')?.main)).toMatch(/Fictive/)
    // À la fin : Alice a changé 2 lignes de src/a.ts, Bob et Chloé 1 chacun.
    const end = await history.replay(genesisId, fixA?.hash ?? '', ['m:app'])
    const app = end.nodes.find((node) => node.key === 'm:app')
    expect(app?.shares.map((share) => share.percent)).toEqual([60, 20, 20])
    expect(app?.main).toBe(app?.last)
    await expect(history.replay(genesisId, 'f'.repeat(40), ['m:app'])).rejects.toMatchObject({ code: 'STALE' })
    const raw = harness(repo, false, null)
    await expect(raw.history.replay(raw.genesisId, fixA?.hash ?? '', ['m:app'])).rejects.toMatchObject({
      code: 'NOT_ANALYZED'
    })
    raw.close()
    close()
  })

  it('should_mark_the_nodes_touched_since_the_last_seen_commit_by_their_last_author', async () => {
    const repo = buildScenario(join(root, 'nouveautes'), 'trois-auteurs')
    const { genesisId, history, close } = harness(repo)
    const [depart, , , fixA] = (await history.replaySteps(genesisId)).commits
    // Vu au départ : feat: a (Bob), feat: b (Chloé) et fix: a (Alice) sont arrivés, tous dans src.
    const since = await history.touched(genesisId, depart?.hash ?? '', fixA?.hash ?? '', ['d:src', 'r:m:app'])
    expect(since.commits).toBe(3)
    expect(since.nodes.map((node) => node.key)).toEqual(['d:src'])
    const src = since.nodes[0]
    expect(since.authors.find((author) => author.key === src?.last)?.name).toMatch(/Fictive/)
    expect(src?.shares.map((share) => share.percent)).toEqual([33, 33, 33])
    const none = await history.touched(genesisId, fixA?.hash ?? '', fixA?.hash ?? '', ['d:src'])
    expect(none).toEqual({ nodes: [], authors: [], commits: 0 })
    await expect(history.touched(genesisId, 'f'.repeat(40), fixA?.hash ?? '', ['d:src'])).rejects.toMatchObject({
      code: 'STALE'
    })
    close()
  })

  it('should_count_commits_in_a_partial_clone_until_everything_is_downloaded', async () => {
    const { work } = bareWithClone(join(root, 'partiel'))
    commit(work, { 'src/a.ts': 'export const a = 1\nexport const b = 2\n' }, 'feat: a', AUTHORS.bob)
    git(work, ['push', '-q'])
    git(work, ['config', 'remote.origin.partialclonefilter', 'blob:none'])
    const { genesisId, history, close } = harness(work)
    const partial = await history.replaySteps(genesisId)
    expect(partial.weight).toBe('commits')
    const last = partial.commits.at(-1)?.hash ?? ''
    expect((await history.replay(genesisId, last, ['d:src'])).nodes[0]?.shares).toEqual([
      { authorKey: partial.commits.at(-1)?.authorKey, percent: 100 }
    ])
    expect(await history.fetchAll(genesisId)).toEqual({ weight: 'lines' })
    expect(git(work, ['config', '--local', '--list'])).not.toMatch(/partialclonefilter/)
    expect((await history.replaySteps(genesisId)).weight).toBe('lines')
    await expect(history.fetchAll(genesisId)).rejects.toMatchObject({ code: 'NOT_PARTIAL' })
    close()
  })
})
