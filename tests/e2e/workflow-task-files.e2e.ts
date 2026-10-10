import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 023 D20 à D22 dans l'app réelle : un projet fictif sans Spec Kit, avec un fichier de tâches à trois états ; la
 * vue Workflow le dessine tel quel (branche, lots, groupes, tâche en cours), deux lectures donnent la même carte.
 */
const DIR = join(tmpdir(), 'gi-e2e-taches')

const USER_STORIES = [
  '# User Stories — Démo',
  '',
  '## Légende',
  'Texte sans case.',
  '',
  '## 1. Comptes',
  '### Inscription',
  '- [x] Compte créé « en attente »',
  '- [~] Mot de passe haché',
  '- [ ] Courriel de vérification',
  '',
  '## 2. Vitrine',
  '- [x] Portfolio sans compte',
  ''
].join('\n')

describe('vue Workflow lue dans les fichiers de tâches (spec 023 D20–D22, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    rmSync(DIR, { recursive: true, force: true })
    freshProfile(() => {
      mkdirSync(join(DIR, 'docs'), { recursive: true })
      writeFileSync(join(DIR, 'docs', 'USER-STORIES.md'), USER_STORIES)
      writeFileSync(join(DIR, 'docs', 'FOUNDATION.md'), '# Fondation\n- [ ] Pas une tâche\n')
      writeFileSync(join(DIR, 'CLAUDE.md'), '- [x] Règle\n')
    })
    run = await launchApp({ GI_E2E_PROJECT: DIR })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
  })
  afterAll(async () => {
    await run?.close()
    rmSync(DIR, { recursive: true, force: true })
  })

  it('should_draw_the_task_file_as_a_fixed_branch_with_its_task_in_progress', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    const branch = page.getByLabel(/Fichier de tâches docs\/USER-STORIES\.md, en cours, 2 sur 4/)
    await branch.waitFor({ timeout: 20_000 })
    await page.getByLabel(/^Tâche en cours : Mot de passe haché/).waitFor()
    await page.getByLabel(/^Tâche à faire : Courriel de vérification/).waitFor()
    // « Légende » n'a pas de case : pas de nœud ; fondation et règles ne sont pas des fichiers de tâches.
    await expect.poll(() => page.getByLabel(/Lot Légende/).count()).toBe(0)
    await expect.poll(() => page.getByLabel(/FOUNDATION|CLAUDE/).count()).toBe(0)
    // Relire donne la même carte (mêmes nœuds, mêmes états) : la structure vient du fichier, rien n'est généré.
    await page.getByRole('button', { name: 'Relire', exact: true }).click()
    await branch.waitFor()
    await page.getByLabel(/^Tâche en cours : Mot de passe haché/).waitFor()
    await page.getByLabel(/^Tâche à faire : Courriel de vérification/).waitFor()
    await page.getByLabel(/1 tâche faite de « Inscription »/).waitFor()
    await run.shot('023-D20-01-fichier-de-taches')
  })

  it('should_keep_a_widget_in_the_view_where_it_was_made_and_send_it_to_another', async () => {
    const { page } = run
    // Workflow affiché : un widget posé dans le vide (clic droit) y naît.
    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 60, y: 420 } })
    await page.getByRole('menuitem', { name: /Widget IA/ }).click()
    const widget = page.getByRole('region', { name: 'Widget IA' })
    await widget.waitFor()
    await page.getByRole('button', { name: 'Progression', exact: true }).click()
    await expect.poll(() => widget.count()).toBe(0)
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    await widget.waitFor()
    // Clic droit sur le widget : « Envoyer vers Progression ».
    await widget.locator('header').click({ button: 'right' })
    await page.getByRole('menuitem', { name: /Envoyer vers Progression/ }).click()
    await expect.poll(() => widget.count()).toBe(0)
    await page.getByRole('button', { name: 'Progression', exact: true }).click()
    await widget.waitFor()
    await run.shot('023-D25-01-widget-dans-sa-vue')
  })

  it('should_connect_a_task_of_the_file_to_a_widget_from_its_hover_handle', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 60, y: 420 } })
    await page.getByRole('menuitem', { name: /Widget IA/ }).click()
    const widget = page.getByRole('region', { name: 'Widget IA' })
    await widget.waitFor()
    // Survol de la tâche en cours : sa poignée apparaît ; on la tire jusqu'au widget.
    const task = page.getByLabel(/^Tâche en cours : Mot de passe/)
    // La carte glisse encore après la bascule de vue : on survole de nouveau jusqu'à voir la poignée.
    const handle = task.locator('.neuron-connector')
    await expect
      .poll(async () => {
        await task.hover()
        return handle.evaluate(
          (element) =>
            (globalThis as unknown as { getComputedStyle(node: unknown): { opacity: string } }).getComputedStyle(
              element
            ).opacity
        )
      })
      .toBe('1')
    await run.shot('023-D24-01-poignee-au-survol')
    const from = await handle.boundingBox()
    const to = await widget.boundingBox()
    if (from === null || to === null) throw new Error('points d’accroche introuvables')
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 })
    await page.mouse.up()
    await page.getByText(/Lire « Mot de passe haché » du Workflow/).waitFor()
    await run.shot('023-D24-02-tache-branchee')
    await page.getByRole('button', { name: 'Plus tard' }).click()
  })
})
