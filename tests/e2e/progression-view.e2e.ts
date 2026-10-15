import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REPRISE_FIXTURES } from '../support/reprise'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 032 D12, D13 dans l'app réelle : la position « Progression » d'un projet lié (le genesis de démo : specs et
 * fichier de tâches fictifs, plus le code C# fictif) couvre la carte ; sans analyse, seules les cases cochées disent le
 * bâti ; analysé, le code non cité par les tâches est hors plan ; les trois lectures, la bascule Réel · Prévu.
 */
const GENESIS = 'Projet démo : application de notes'
/** Un lot bâti (son fichier existe), un lot prévu (son fichier n'existe pas encore) ; le reste du code est hors plan. */
const TASKS = [
  '# Tâches — Commandes',
  '',
  '## Passer une commande',
  '- [x] Calculer la remise dans `Domain/OrderService.cs`',
  '',
  '## Rembourser',
  '- [ ] Rembourser une commande dans `Domain/Refunds.cs`',
  ''
].join('\n')

describe('Progression en trois lectures (spec 032 D12, D13, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => {
      cpSync(join(REPRISE_FIXTURES, 'cs-app'), DEMO_PROJECT, { recursive: true })
      mkdirSync(join(DEMO_PROJECT, 'docs'), { recursive: true })
      writeFileSync(join(DEMO_PROJECT, 'docs', 'TACHES-COMMANDES.md'), TASKS)
    })
    run = await launchApp()
    await run.page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_read_the_progress_of_the_project_in_three_ways_then_return_to_the_workflow', async () => {
    const { page } = run
    const bar = page.getByRole('group', { name: 'Lecture de la carte de structure' })
    await bar.getByRole('button', { name: 'Progression' }).click({ timeout: 30_000 })
    const panel = page.getByRole('region', { name: 'Progression du projet' })
    await panel.getByText(/Le code n’est pas analysé/).click()
    await panel.getByRole('radio', { name: /Local uniquement/ }).check()
    await panel.getByRole('button', { name: 'Analyser', exact: true }).click()
    await panel
      .getByText(/^\d+ lots? bâtis? · \d+ prévus? · [1-9]\d* fichiers? hors plan$/)
      .waitFor({ timeout: 90_000 })
    // Le fichier de tâches est une famille : une case cochée dont le fichier existe, il est bâti.
    expect(await panel.getByRole('listitem', { name: 'Tâches — Commandes : bâti, 1 / 2 tâches' }).count()).toBe(1)
    expect(await panel.getByRole('region', { name: 'Hors plan' }).count()).toBe(1)
    await run.shot('032-d12-01-arbre')
    await panel.getByRole('button', { name: 'B · Le chantier par étages' }).click()
    await panel.getByRole('list', { name: 'Étages du projet' }).waitFor()
    await run.shot('032-d12-02-etages')
    await panel.getByRole('button', { name: 'C · Les lots du Workflow' }).click()
    await panel.getByRole('list', { name: 'Lots du Workflow' }).waitFor()
    await run.shot('032-d12-03-lots')
    await panel.getByRole('button', { name: 'Prévu' }).click()
    expect(await panel.getByRole('region', { name: 'Hors plan' }).count()).toBe(0)
    await panel.getByRole('button', { name: 'Workflow', exact: true }).click()
    await bar.waitFor()
    expect(await page.getByRole('region', { name: 'Progression du projet' }).count()).toBe(0)
  })
})
