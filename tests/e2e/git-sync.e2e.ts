import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commit, git, initRepo } from '../support/gitRepos'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 021 US2 dans l'app réelle (quickstart §2) : un dépôt nu local sert de distant au projet de démo (transport local
 * permis par `GI_E2E_LOCAL_REMOTES`, seulement avec `--e2e`). Pousser deux commits après l'aperçu, puis vérifier le
 * distant et tirer un commit poussé par un collègue fictif. Aucun appel réseau.
 */
const BARE = join(tmpdir(), 'gi-e2e-distant.git')
const OTHER = join(tmpdir(), 'gi-e2e-collegue')

describe('publier, tirer, pousser dans l’app (spec 021 US2, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    rmSync(BARE, { recursive: true, force: true })
    rmSync(OTHER, { recursive: true, force: true })
    freshProfile(() => {
      mkdirSync(BARE, { recursive: true })
      git(BARE, ['init', '-q', '--bare', '-b', 'main'])
      initRepo(DEMO_PROJECT)
      commit(DEMO_PROJECT, { 'README.md': '# Projet fictif\n' }, 'chore: départ')
      git(DEMO_PROJECT, ['remote', 'add', 'origin', BARE])
      git(DEMO_PROJECT, ['push', '-q', '-u', 'origin', 'main'])
      commit(DEMO_PROJECT, { 'a.ts': 'export const a = 1\n' }, 'feat: a')
      commit(DEMO_PROJECT, { 'b.ts': 'export const b = 2\n' }, 'feat: b')
    })
    run = await launchApp({ GI_E2E_LOCAL_REMOTES: '1' })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
  })
  afterAll(async () => {
    await run?.close()
    rmSync(BARE, { recursive: true, force: true })
    rmSync(OTHER, { recursive: true, force: true })
  })

  it('should_push_two_commits_after_the_preview', async () => {
    const { page } = run
    const badge = page.getByRole('button', { name: /^Dépôt : ⎇ main/ })
    await badge.waitFor({ timeout: 30_000 })
    await badge.evaluate((element) => (element as unknown as { click(): void }).click())
    const panel = page.getByRole('complementary', { name: 'Dépôt' })
    await panel.getByRole('button', { name: '↑ Pousser (2)' }).click()
    await panel.getByRole('list', { name: 'Commits à pousser' }).waitFor()
    expect(await panel.getByText('Aucun fichier sensible dans les commits à pousser.').count()).toBe(1)
    await run.shot('021-us2-01-apercu-push')
    await panel.getByRole('button', { name: 'Pousser 2 commits' }).click()
    await panel.getByText(/2 commit\(s\) poussé\(s\)/).waitFor()
    expect(git(BARE, ['log', '--format=%s', 'main']).trim().split('\n')).toEqual([
      'feat: b',
      'feat: a',
      'chore: départ'
    ])
    await run.shot('021-us2-02-pousse')
    await panel.getByRole('button', { name: 'Retour' }).click()
  })

  it('should_check_the_remote_and_pull_a_commit_pushed_elsewhere', async () => {
    git(tmpdir(), ['clone', '-q', BARE, OTHER])
    git(OTHER, ['config', 'user.name', 'Collègue Fictif'])
    git(OTHER, ['config', 'user.email', 'collegue@example.invalid'])
    commit(OTHER, { 'c.ts': 'export const c = 3\n' }, 'feat: c')
    git(OTHER, ['push', '-q', 'origin', 'main'])

    const panel = run.page.getByRole('complementary', { name: 'Dépôt' })
    await panel.getByRole('button', { name: 'Vérifier le distant' }).click()
    await panel.getByRole('button', { name: '↓ Tirer (1)' }).click()
    await panel.getByText('1 commit(s) tiré(s).').waitFor()
    expect(git(DEMO_PROJECT, ['log', '-1', '--format=%s']).trim()).toBe('feat: c')
    await run.shot('021-us2-03-tire')
  })
})
