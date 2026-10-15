import { cpSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REPRISE_FIXTURES } from '../support/reprise'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 032 D14, D15 dans l'app réelle : la position « Architecture » de la barre d'un projet lié (le genesis de démo,
 * sur le projet C# fictif) monte l'explorateur dans la carte ; sans analyse, elle propose de la lancer ; le détecteur
 * dit l'architecture reconnue et sa raison, mentalyas la corrige ; « Workflow » rend la carte.
 */
const GENESIS = 'Projet démo : application de notes'

describe('Architecture = l’explorateur dans la carte (spec 032 D14, D15, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => cpSync(join(REPRISE_FIXTURES, 'cs-app'), DEMO_PROJECT, { recursive: true }))
    run = await launchApp()
    await run.page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_mount_the_explorer_with_its_detected_architecture_and_switch_back_to_the_map', async () => {
    const { page } = run
    const bar = page.getByRole('group', { name: 'Lecture de la carte de structure' })
    await bar.getByRole('button', { name: 'Architecture' }).click({ timeout: 30_000 })
    await page.getByRole('heading', { name: 'Le code de ce projet n’est pas encore analysé' }).waitFor()
    await page.getByRole('radio', { name: /Local uniquement/ }).check()
    await page.getByRole('button', { name: 'Analyser', exact: true }).click()
    await page.getByRole('group', { name: /module Domain/ }).waitFor({ timeout: 90_000 })
    const detector = page.getByRole('group', { name: 'Architecture du projet' })
    await detector.getByText('reconnue par l’app').waitFor()
    expect(await detector.getByRole('combobox', { name: 'Architecture' }).inputValue()).toBe('clean')
    expect(await detector.textContent()).toContain('Dossiers « Domain » et « Infrastructure »')
    await run.shot('032-d14-01-architecture')
    await detector.getByRole('combobox', { name: 'Architecture' }).selectOption('mvc')
    await detector.getByText('choisie par toi').waitFor()
    await run.shot('032-d15-02-correction')
    // La bascule remplace « ← Carte » : Workflow rend la carte et sa barre (la carte dessous est inerte).
    const explorer = page.getByRole('region', { name: /Explorateur · / })
    expect(await explorer.getByRole('button', { name: '← Carte' }).count()).toBe(0)
    // La bascule est dans la barre fine (spec 033 D10).
    await bar.getByRole('button', { name: 'Workflow', exact: true }).click()
    await bar.waitFor()
    expect(await page.getByRole('group', { name: 'Architecture du projet' }).count()).toBe(0)
  })
})
