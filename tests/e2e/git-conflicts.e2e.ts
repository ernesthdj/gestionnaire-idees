import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario, git } from '../support/gitRepos'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 021 US4 dans l'app réelle (quickstart §4) : le scénario `conflit` (deux côtés ont modifié `src/liste.ts` et
 * `logo.png`) sert de projet de démo ; tirer, fusionner, la vue de résolution remplace la carte, choix bloc par bloc,
 * choix entier pour le binaire, « Terminer la fusion ». Claude n'est pas appelé (choix à la main) ; aucun réseau.
 */
const DIR = join(tmpdir(), 'gi-e2e-conflit')

describe('résoudre un conflit dans l’app (spec 021 US4, e2e)', () => {
  let run: LaunchedApp
  let work = ''

  beforeAll(async () => {
    rmSync(DIR, { recursive: true, force: true })
    freshProfile(() => {
      work = buildScenario(DIR, 'conflit')
    })
    run = await launchApp({ GI_E2E_LOCAL_REMOTES: '1', GI_E2E_PROJECT: work })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
  })
  afterAll(async () => {
    await run?.close()
    rmSync(DIR, { recursive: true, force: true })
  })

  it('should_open_the_resolution_view_after_a_merge_with_conflicts', async () => {
    const { page } = run
    const badge = page.getByRole('button', { name: /^Dépôt : ⎇ main/ })
    await badge.waitFor({ timeout: 30_000 })
    await badge.evaluate((element) => (element as unknown as { click(): void }).click())
    const panel = page.getByRole('complementary', { name: 'Dépôt' })
    await panel.getByRole('button', { name: '↓ Tirer (1)' }).click()
    await panel.getByRole('button', { name: 'Fusionner les deux historiques' }).click()
    await page.getByRole('region', { name: 'Résolution de la fusion' }).waitFor()
    await run.shot('021-us4-01-vue-resolution')
  })

  it('should_resolve_the_binary_and_the_text_then_finish', async () => {
    const view = run.page.getByRole('region', { name: 'Résolution de la fusion' })
    await view.getByRole('button', { name: 'Garder ta version' }).click()
    const block = view.getByRole('region', { name: 'Bloc 1' })
    await block.waitFor()
    // Le choix se coche au retour de la décision enregistrée par le main.
    await block.getByLabel('Leur version').click()
    await block.getByRole('radio', { name: 'Leur version', checked: true }).waitFor()
    await view.getByRole('button', { name: 'Valider ce fichier' }).click()
    await view.getByText('Tout est résolu : tu peux terminer.').waitFor()
    await run.shot('021-us4-02-tout-resolu')
    await view.getByRole('button', { name: 'Terminer la fusion' }).click()
    await view.getByText(/Fusion terminée/).waitFor()
    expect(git(work, ['log', '-1', '--format=%P']).trim().split(' ')).toHaveLength(2)
    expect(readFileSync(join(work, 'src', 'liste.ts'), 'utf8').replace(/\r\n/g, '\n')).toBe(
      'export const liste = [1, 2, 3, 4]\n'
    )
    await run.shot('021-us4-03-fusion-terminee')
  })
})
