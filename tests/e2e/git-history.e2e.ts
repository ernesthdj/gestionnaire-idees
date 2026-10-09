import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario } from '../support/gitRepos'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 021 US5 (lot 1) dans l'app réelle (quickstart §5) : le scénario `trois-auteurs` sert de projet de démo ; la
 * frise de l'onglet Historique montre une ligne par auteur, se parcourt au clavier, et deux identités se fusionnent puis
 * se séparent. « Raconter la période » (Claude) est couvert en intégration avec une passerelle simulée.
 */
const DIR = join(tmpdir(), 'gi-e2e-trois-auteurs')

describe('qui a fait quoi et quand dans l’app (spec 021 US5, e2e)', () => {
  let run: LaunchedApp
  let work = ''

  beforeAll(async () => {
    rmSync(DIR, { recursive: true, force: true })
    freshProfile(() => {
      work = buildScenario(DIR, 'trois-auteurs')
    })
    run = await launchApp({ GI_E2E_PROJECT: work })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
  })
  afterAll(async () => {
    await run?.close()
    rmSync(DIR, { recursive: true, force: true })
  })

  it('should_show_the_timeline_and_merge_then_separate_two_identities', async () => {
    const { page } = run
    const badge = page.getByRole('button', { name: /^Dépôt : ⎇ main/ })
    await badge.waitFor({ timeout: 30_000 })
    await badge.evaluate((element) => (element as unknown as { click(): void }).click())
    const panel = page.getByRole('complementary', { name: 'Dépôt' })
    await panel.getByRole('tab', { name: 'Historique' }).click()
    const timeline = panel.getByRole('region', { name: 'Frise des auteurs' })
    await timeline.waitFor()
    expect(await timeline.getByRole('list', { name: 'Légende des auteurs' }).getByRole('listitem').count()).toBe(3)
    await timeline.getByRole('button', { name: /^chore: départ,/ }).click()
    await page.keyboard.press('ArrowRight')
    await timeline.getByText(/sélection : « feat: a »/).waitFor()
    await run.shot('021-us5-01-frise')

    await timeline.getByLabel('Choisir Chloé Fictive pour fusionner').check()
    await timeline.getByLabel('Choisir Bob Fictif pour fusionner').check()
    await timeline.getByRole('button', { name: 'Fusionner les identités' }).click()
    await timeline.getByRole('button', { name: 'Séparer' }).waitFor()
    expect(await timeline.getByRole('list', { name: 'Légende des auteurs' }).getByRole('listitem').count()).toBe(2)
    await run.shot('021-us5-02-identites-fusionnees')
    await timeline.getByRole('button', { name: 'Séparer' }).click()
    await timeline.getByRole('button', { name: 'Séparer' }).waitFor({ state: 'detached' })
    expect(await timeline.getByRole('list', { name: 'Légende des auteurs' }).getByRole('listitem').count()).toBe(3)
  })

  it('should_offer_to_update_the_project_map_from_its_bar', async () => {
    // Le clic lancerait Claude (réel) : le calcul des changements est couvert en intégration, l'envoi en test d'interface.
    const button = run.page.getByRole('button', { name: 'Mettre à jour la carte' })
    await button.waitFor()
    expect(await button.isEnabled()).toBe(true)
    await run.shot('022-maj-carte-bouton')
  })
})
