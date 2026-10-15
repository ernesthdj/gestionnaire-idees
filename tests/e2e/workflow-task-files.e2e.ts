import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshProfile, launchApp, settled, type LaunchedApp } from './support/app'

/**
 * Spec 023 D20 à D22, spec 032 lot 2 dans l'app réelle : un projet fictif sans Spec Kit, avec un fichier de tâches à
 * trois états ; la vue Workflow le dessine en ronds (fichier, lots, groupes) et en carrés (tâches), le carré en cours
 * porte « Bosser ici » ; deux lectures donnent la même carte.
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
      // Un fichier de tâches s'implémente quand un brainstorm complet le nomme (spec 032 Q10).
      mkdirSync(join(DIR, 'docs', 'brainstorm'), { recursive: true })
      writeFileSync(
        join(DIR, 'docs', 'brainstorm', 'L1-comptes.md'),
        '# L1 — Comptes et vitrine\n\n**Maturité** : complet · **Tâches** : docs/USER-STORIES.md\n'
      )
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
    const branch = page.getByLabel(/^Rond User Stories — Démo, brainstorm 100 %, 2 sur 4 tâches/)
    await branch.waitFor({ timeout: 20_000 })
    await page.getByLabel(/^Carré Mot de passe haché, en cours, bosser ici/).waitFor()
    await page.getByLabel(/^Carré Courriel de vérification, à faire/).waitFor()
    // « Légende » n'a pas de case : pas de nœud ; fondation et règles ne sont pas des fichiers de tâches.
    await expect.poll(() => page.getByLabel(/Rond Légende/).count()).toBe(0)
    await expect.poll(() => page.getByLabel(/FOUNDATION|CLAUDE/).count()).toBe(0)
    // Relire donne la même carte (mêmes nœuds, mêmes états) : la structure vient du fichier, rien n'est généré.
    await page.getByRole('button', { name: 'Relire', exact: true }).click()
    await branch.waitFor()
    // Sous son brainstorm, l'arbre a un niveau de plus : on cadre tout (la carte ne dessine que ce qui est visible).
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await page.getByLabel(/^Carré Mot de passe haché, en cours/).waitFor()
    await page.getByLabel(/^Carré Courriel de vérification, à faire/).waitFor()
    await page.getByLabel(/^Carré Compte créé « en attente », faite/).waitFor()
    await page.getByText('▶ Bosser ici').waitFor()
    await run.shot('032-lot2-01-ronds-et-carres')
  })

  it('should_keep_a_widget_in_the_view_where_it_was_made_and_send_it_to_another', async () => {
    const { page } = run
    // Workflow affiché : un widget posé dans le vide (clic droit) y naît.
    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 60, y: 420 } })
    await page.getByRole('menuitem', { name: /Widget IA/ }).click()
    const widget = page.getByRole('region', { name: 'Widget IA' })
    await widget.waitFor()
    await page.getByRole('button', { name: 'Progression', exact: true }).click()
    // Le panneau Progression (spec 032) se replie pour montrer la carte de la vue et ses widgets.
    await page.getByRole('button', { name: '▾ Voir la carte' }).click()
    await expect.poll(() => widget.count()).toBe(0)
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    await widget.waitFor()
    // Clic droit sur le widget : « Envoyer vers Progression ».
    await widget.locator('header').click({ button: 'right' })
    await page.getByRole('menuitem', { name: /Envoyer vers Progression/ }).click()
    await expect.poll(() => widget.count()).toBe(0)
    await page.getByRole('button', { name: 'Progression', exact: true }).click()
    await page.getByRole('button', { name: '▾ Voir la carte' }).click()
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
    const task = page.getByLabel(/^Carré Mot de passe haché/)
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
    const from = await settled(handle)
    const to = await settled(widget)
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 })
    await page.mouse.up()
    await page.getByText(/Lire « Mot de passe haché » du Workflow/).waitFor()
    await run.shot('023-D24-02-tache-branchee')
    await page.getByRole('button', { name: 'Plus tard' }).click()
  })

  it('should_open_the_square_to_work_on_with_its_instruction_waiting_in_its_conversation', async () => {
    const { page } = run
    // SC-002 : un geste sur « Bosser ici » ouvre sa conversation, la consigne prête (rien n'est envoyé).
    const next = page.getByLabel(/^Carré Mot de passe haché, en cours, bosser ici/)
    await settled(next)
    await next.dblclick({ force: true })
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    const field = panel.getByLabel('Message à Claude')
    await expect.poll(() => field.inputValue(), { timeout: 15_000 }).toContain('Fais la tâche « Mot de passe haché »')
    await run.shot('032-lot2-02-bosser-ici')
  })
})
