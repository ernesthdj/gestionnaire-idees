import type { Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario, writeFiles } from '../support/gitRepos'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 030 « Avancement fiable » dans l'app réelle (SC-001 à SC-003) : statut des modules calculé d'après leurs
 * sous-éléments, statut changé à la main puis annulé, proposition « livrée » après un commit qui couvre le fichier d'un
 * élément. Carte de structure du genesis de démo, dépôt fictif posé comme son dossier.
 */
const GENESIS = 'Projet démo : application de notes'

/** Nom accessible d'un élément de la carte (type et titre), qui porte son statut affiché. */
const elementName = (page: Page, type: string, title: string): Promise<string | null> =>
  page.getByRole('group', { name: new RegExp(`${type} « ${title} »`) }).getAttribute('aria-label')

describe('avancement fiable de la carte de structure (spec 030, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => {
      buildScenario(DEMO_PROJECT, 'hook-temoin')
      writeFiles(DEMO_PROJECT, { 'src/ecran.ts': 'export const ecran = 1\n' })
    })
    run = await launchApp()
    await run.page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
    await run.page.getByRole('button', { name: 'Tout afficher' }).click()
    // Les nœuds glissent vers leur place après l'ouverture : on attend qu'ils s'arrêtent avant de cliquer.
    await run.page.waitForTimeout(1500)
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_show_a_module_in_progress_from_its_children_and_change_a_status_by_hand_then_undo_it', async () => {
    const { page } = run
    // « Données » est marqué livré, mais sa tâche « Sauvegarde nocturne » est à faire : il est en cours.
    expect(await elementName(page, 'module', 'Données')).toContain('en cours d’après ses sous-éléments')
    await page.getByRole('group', { name: /tache « Sauvegarde nocturne »/ }).click({ force: true })
    const card = page.getByRole('dialog', { name: 'Détails : Sauvegarde nocturne' })
    await card.getByRole('combobox', { name: 'Statut de « Sauvegarde nocturne »' }).selectOption('livree')
    await page.getByRole('status').filter({ hasText: 'Statut de « Sauvegarde nocturne » : livrée' }).waitFor()
    await expect.poll(() => elementName(page, 'module', 'Données')).toContain('livrée d’après ses sous-éléments')
    await run.shot('030-01-statut-a-la-main')
    await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click()
    await expect.poll(() => elementName(page, 'tache', 'Sauvegarde nocturne')).toContain('à faire')
    await expect.poll(() => elementName(page, 'module', 'Données')).toContain('en cours d’après ses sous-éléments')
    await card.getByRole('button', { name: 'Fermer la carte' }).click()
  })

  it('should_propose_to_deliver_the_element_covered_by_a_commit_and_do_it_on_click', async () => {
    const { page } = run
    const badge = page.getByRole('button', { name: /^Dépôt : ⎇ main/ })
    await badge.waitFor({ timeout: 30_000 })
    await badge.evaluate((element) => (element as unknown as { click(): void }).click())
    const panel = page.getByRole('region', { name: 'Dépôt' })
    await panel.getByRole('checkbox', { name: 'Préparer src/ecran.ts' }).click()
    await panel.getByRole('checkbox', { name: 'Retirer src/ecran.ts', checked: true }).waitFor()
    await panel.getByLabel('Message du commit').fill('feat(demo): écran principal')
    await panel.getByRole('button', { name: /Commiter \(1 fichier\)/ }).click()
    const offer = panel.getByRole('region', { name: 'Éléments couverts par ce commit' })
    await offer.waitFor()
    // Seule la feuille couverte est proposée, cochée d'office ; le module « Application » (dossier src) ne l'est pas.
    expect(await offer.getByRole('checkbox').count()).toBe(1)
    expect(await offer.getByRole('checkbox', { name: /Écran principal/ }).isChecked()).toBe(true)
    await run.shot('030-02-proposition-livree')
    await offer.getByRole('button', { name: 'Passer en livrée (1)' }).click()
    await offer.waitFor({ state: 'detached' })
    await expect.poll(() => elementName(page, 'composant', 'Écran principal')).toContain('livrée')
    await run.shot('030-03-livree-au-commit')
  })
})
