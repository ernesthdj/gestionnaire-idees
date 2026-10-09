import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locator } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario, git, writeFiles } from '../support/gitRepos'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 021 US1 dans l'app réelle (quickstart §1) : badge du genesis, volet Dépôt, commit de 2 fichiers sur 3 sans
 * co-auteur, `.env` verrouillé, hook non lancé hors confiance, « la sélection a changé », branches, annulation d'un
 * commit. Dépôt fictif `hook-temoin` posé comme dossier du genesis de démo.
 */
/** Cocher prépare le fichier côté git : la case se coche au retour de l'état (son nom devient « Retirer … »). */
async function prepare(panel: Locator, path: string): Promise<void> {
  await panel.getByRole('checkbox', { name: `Préparer ${path}` }).click()
  await panel.getByRole('checkbox', { name: `Retirer ${path}`, checked: true }).waitFor()
}

describe('volet Dépôt dans l’app (spec 021 US1, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => {
      buildScenario(DEMO_PROJECT, 'hook-temoin')
      writeFiles(DEMO_PROJECT, { 'a.txt': 'A\n', 'b.txt': 'B\n', 'c.txt': 'C\n', '.env': 'API_KEY=faux\n' })
    })
    run = await launchApp()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_show_the_repo_badge_and_open_the_panel_with_nothing_checked', async () => {
    const { page } = run
    const badge = page.getByRole('button', { name: /^Dépôt : ⎇ main · 4 modifiés/ })
    await badge.waitFor({ timeout: 30_000 })
    await badge.evaluate((element) => (element as unknown as { click(): void }).click())
    const panel = page.getByRole('complementary', { name: 'Dépôt' })
    await panel.waitFor()
    const boxes = panel.getByRole('checkbox')
    expect(await boxes.count()).toBe(4)
    for (const box of await boxes.all()) expect(await box.isChecked()).toBe(false)
    expect(await panel.getByRole('checkbox', { name: 'Préparer .env' }).isDisabled()).toBe(true)
    await run.shot('021-us1-01-volet')
  })

  it('should_commit_only_the_two_checked_files_without_running_the_untrusted_hook', async () => {
    const { page } = run
    const panel = page.getByRole('complementary', { name: 'Dépôt' })
    await prepare(panel, 'a.txt')
    await panel.getByRole('button', { name: /Commiter \(1 fichier\)/ }).waitFor()
    await prepare(panel, 'b.txt')
    await panel.getByRole('button', { name: /Commiter \(2 fichiers\)/ }).waitFor()
    await panel.getByRole('button', { name: 'a.txt' }).click()
    await panel.getByRole('region', { name: 'Différences de a.txt' }).waitFor()
    await panel
      .getByLabel('Message du commit')
      .fill('test(e2e): a et b\n\nCo-Authored-By: Personne <x@example.invalid>')
    await run.shot('021-us1-02-avant-commit')
    await panel.getByRole('button', { name: /Commiter \(2 fichiers\)/ }).click()
    await panel
      .getByRole('status')
      .filter({ hasText: /^Commit / })
      .waitFor()
    expect(git(DEMO_PROJECT, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').sort()).toEqual([
      'a.txt',
      'b.txt'
    ])
    expect(git(DEMO_PROJECT, ['log', '-1', '--format=%B'])).not.toMatch(/co-authored-by/i)
    expect(existsSync(join(DEMO_PROJECT, 'hook-a-tourne.txt'))).toBe(false)
    expect(git(DEMO_PROJECT, ['status', '--porcelain']).trim().split('\n').sort()).toEqual(['?? .env', '?? c.txt'])
    await run.shot('021-us1-03-apres-commit')
  })

  it('should_refuse_the_commit_when_the_selection_changed_outside_the_app', async () => {
    const { page } = run
    const panel = page.getByRole('complementary', { name: 'Dépôt' })
    await prepare(panel, 'c.txt')
    await panel.getByRole('button', { name: /Commiter \(1 fichier\)/ }).waitFor()
    writeFileSync(join(DEMO_PROJECT, 'd.txt'), 'D\n')
    git(DEMO_PROJECT, ['add', '--', 'd.txt'])
    await panel.getByLabel('Message du commit').fill('test(e2e): c')
    await panel.getByRole('button', { name: /Commiter \(1 fichier\)/ }).click()
    await panel.getByRole('alert').filter({ hasText: 'La sélection a changé' }).waitFor()
    await run.shot('021-us1-04-selection-changee')
    git(DEMO_PROJECT, ['restore', '--staged', '--', 'c.txt', 'd.txt'])
  })

  it('should_create_a_branch_and_switch_back', async () => {
    const { page } = run
    const panel = page.getByRole('complementary', { name: 'Dépôt' })
    await panel.getByRole('tab', { name: 'Branches' }).click()
    await panel.getByLabel('Nouvelle branche').fill('essai/volet')
    await panel.getByRole('button', { name: 'Créer et y passer' }).click()
    await panel.getByRole('button', { name: 'Passer sur main' }).waitFor()
    expect(git(DEMO_PROJECT, ['branch', '--show-current']).trim()).toBe('essai/volet')
    await panel.getByRole('button', { name: 'Passer sur main' }).click()
    await panel.getByRole('button', { name: 'Passer sur essai/volet' }).waitFor()
    expect(git(DEMO_PROJECT, ['branch', '--show-current']).trim()).toBe('main')
    await run.shot('021-us1-05-branches')
  })

  it('should_revert_the_last_commit_after_confirmation', async () => {
    const { page } = run
    const panel = page.getByRole('complementary', { name: 'Dépôt' })
    await panel.getByRole('tab', { name: 'Historique' }).click()
    await panel.getByRole('button', { name: 'Annuler le commit test(e2e): a et b' }).click()
    await panel.getByRole('button', { name: 'Confirmer l’annulation' }).click()
    await panel.getByText('Revert "test(e2e): a et b"').waitFor()
    expect(git(DEMO_PROJECT, ['log', '-1', '--format=%s']).trim()).toBe('Revert "test(e2e): a et b"')
    await run.shot('021-us1-06-historique')
  })
})
