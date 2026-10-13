import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario } from '../support/gitRepos'
import { freshProfile, launchApp, SHOTS, type LaunchedApp } from './support/app'

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
    const panel = page.getByRole('region', { name: 'Dépôt' })
    await panel.getByRole('tab', { name: 'Historique' }).click()
    const timeline = panel.getByRole('region', { name: 'Frise des auteurs' })
    await timeline.waitFor()
    expect(await timeline.getByRole('list', { name: 'Légende des auteurs' }).getByRole('listitem').count()).toBe(3)
    // Les commits du scénario datent du même jour : ceux d'Alice sont regroupés en un point (« 2 commits »).
    await timeline.getByRole('button', { name: /^2 commits du .*Fictive$/ }).waitFor()
    await timeline.getByRole('button', { name: /^feat: a,/ }).click()
    await timeline.getByText(/sélection : « feat: a »/).waitFor()
    // Les flèches passent au point voisin (même tranche : ordre des auteurs) ; Bob peut être le premier point.
    await page.keyboard.press('ArrowLeft')
    if ((await timeline.getByText(/sélection : « feat: a »/).count()) > 0) await page.keyboard.press('ArrowRight')
    await timeline.getByText(/sélection : « (?!feat: a »)/).waitFor()
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

  it('should_show_the_skyline_of_all_authors_then_of_one_in_2d_and_3d', async () => {
    const { page } = run
    const panel = page.getByRole('region', { name: 'Dépôt' })
    const skyline = panel.getByRole('region', { name: 'Skyline des contributions' })
    await skyline.getByText(/Tous les auteurs : \d+ commits? sur un mois/).waitFor()
    // Le relief monte en vague (1,3 s) la première fois qu'il est vu.
    await page.waitForTimeout(1800)
    await skyline.screenshot({ path: join(SHOTS, '021-d16-01-skyline-3d.png') })
    await panel.getByRole('button', { name: 'Skyline de Bob Fictif' }).click()
    await skyline.getByText(/Bob Fictif : \d+ commits? sur un (mois|an)/).waitFor()
    await skyline.getByRole('button', { name: 'Carte de chaleur' }).click()
    await page.waitForTimeout(1800)
    await skyline.screenshot({ path: join(SHOTS, '021-d16-02-skyline-2d-auteur.png') })
    await skyline.getByLabel('Couleurs de la Skyline').selectOption('ocean')
    await page.waitForTimeout(800)
    await skyline.screenshot({ path: join(SHOTS, '021-d16-03-skyline-ocean.png') })
    const frise = panel.getByRole('region', { name: 'Frise des auteurs' })
    for (const zoom of ['semaine', 'mois', 'année'] as const) {
      await frise.getByRole('button', { name: zoom, exact: true }).click()
      await frise.screenshot({ path: join(SHOTS, `021-us5-frise-${zoom}.png`) })
    }
    await skyline.getByLabel('Couleurs de la Skyline').selectOption('auto')
    // Entrée sur le jour actif (le dernier) : la frise se centre sur ce jour.
    await skyline.getByRole('img').focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Enter')
    await panel.getByRole('button', { name: 'Revenir au plus récent' }).click()
    await panel.getByRole('button', { name: 'Skyline de Bob Fictif' }).click()
  })

  it('should_offer_to_update_the_project_map_from_its_bar', async () => {
    // Le clic lancerait Claude (réel) : le calcul des changements est couvert en intégration, l'envoi en test d'interface.
    const button = run.page.getByRole('button', { name: 'Mettre à jour la carte' })
    await button.waitFor()
    expect(await button.isEnabled()).toBe(true)
    await run.shot('022-maj-carte-bouton')
  })
})
