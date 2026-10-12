import { afterAll, beforeAll, describe, it } from 'vitest'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 017 T037 : le profil démo porte un projet repris fictif « Local uniquement », analysé à sa création ; son
 * explorateur s'ouvre sur ses modules. Rien n'est envoyé à Claude.
 */
describe('projet repris de la démo (spec 017 T037, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile()
    run = await launchApp({ GI_E2E_REPRISE_DEMO: '1' })
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_open_the_explorer_of_the_analysed_demo_project_in_local_only_mode', async () => {
    const { page } = run
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Idées', { exact: true }).click()
    // Un projet lié à un dossier a son propre canevas (spec 024) : on l'ouvre depuis la liste des projets.
    await page.getByText('boutique-demo', { exact: true }).first().click()
    await page.locator('.react-flow').waitFor()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await run.shot('017-t037-01-carte')
    await page.getByRole('group', { name: /: boutique-demo,/ }).click({ force: true, timeout: 60_000 })
    await page
      .getByRole('dialog', { name: 'Détails : boutique-demo' })
      .getByRole('button', { name: 'Discuter' })
      .click()
    await page.getByRole('button', { name: 'Ouvrir l’explorateur' }).click({ timeout: 60_000 })
    await page.getByRole('heading', { name: /Explorateur · boutique-demo/ }).waitFor()
    await page.getByText('Local uniquement').first().waitFor()
    await page.getByRole('button', { name: 'Vue liste' }).click()
    const items = page.getByRole('region', { name: 'Éléments de ce niveau' })
    for (const module of ['api', 'core', 'infra']) {
      await items
        .getByRole('button', { name: new RegExp(`${module}$`) })
        .first()
        .waitFor({ timeout: 60_000 })
    }
    // Liens mesurés par l'analyse : sûrs entre les couches, un appel incertain que l'IA locale peut préciser.
    await page.getByText('api → core : 4 appels, sûr').waitFor()
    await page.getByRole('button', { name: /Préciser les liens avec l’IA \(\d+\)/ }).waitFor()
    await run.shot('017-t037-02-explorateur')
  })
})
