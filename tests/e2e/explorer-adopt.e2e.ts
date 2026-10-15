import { cpSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REPRISE_FIXTURES } from '../support/reprise'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp, openProjectMenu } from './support/app'

/**
 * Spec 017 D23 dans l'app réelle : un projet déjà lié à son dossier (le genesis de démo, sur un projet C# fictif) n'a
 * pas d'explorateur ; « Analyser le code… » dans sa barre, confidentialité choisie, l'analyse tourne sur le genesis
 * existant et l'explorateur s'ouvre sur ses modules ; la barre propose ensuite « Explorateur ».
 */
const GENESIS = 'Projet démo : application de notes'

describe('analyser le code d’un projet déjà lié (spec 017 D23, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => cpSync(join(REPRISE_FIXTURES, 'cs-app'), DEMO_PROJECT, { recursive: true }))
    run = await launchApp()
    await run.page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_analyse_the_linked_folder_and_open_the_explorer_from_the_bar', async () => {
    const { page } = run
    // Plus de bouton « Explorateur » (spec 033 D4) : « Analyser le code… » est dans le menu du projet.
    expect(await page.getByRole('button', { name: 'Explorateur', exact: true }).count()).toBe(0)
    await openProjectMenu(page)
    await page.getByRole('button', { name: 'Analyser le code…' }).click({ timeout: 30_000 })
    const panel = page.getByRole('region', { name: 'Analyser le code du projet' })
    expect(await panel.getByRole('button', { name: 'Analyser', exact: true }).isDisabled()).toBe(true)
    await panel.getByRole('radio', { name: /Local uniquement/ }).check()
    await run.shot('017-d23-01-analyser')
    await panel.getByRole('button', { name: 'Analyser', exact: true }).click()
    await page.getByRole('heading', { name: /Explorateur · / }).waitFor({ timeout: 30_000 })
    await page.getByRole('group', { name: /module Domain/ }).waitFor({ timeout: 90_000 })
    await run.shot('017-d23-02-explorateur')
    // L'analyse ouvre la vue Architecture du projet ; « Workflow » rend la carte.
    await page
      .getByRole('group', { name: 'Lecture de la carte de structure' })
      .getByRole('button', { name: 'Workflow', exact: true })
      .click()
    // Aucun nœud de plus sur la carte : l'analyse vit sur le genesis existant.
    expect(await page.getByRole('group', { name: /: cs-app,/ }).count()).toBe(0)
  })
})
