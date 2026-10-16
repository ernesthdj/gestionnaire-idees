import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario } from '../support/gitRepos'
import { DEMO_PROJECT, freshProfile, launchApp, settled, type LaunchedApp } from './support/app'

/**
 * Le PO cadre un lot entier (docs/TACHES-AGENTS.md T021, T023 ; L1o D25) dans l'app réelle : un PO appelé sur le rond
 * d'un lot de deux tâches rend une spec de lot (simulée : une ligne d'aiguillage par tâche et un conseil de rythme) ;
 * le volet Agents du lot montre l'aiguillage, les profils qui manquent à l'équipe, puis l'équipe au complet, et une
 * tâche retouchée à la main. Sessions simulées (`GI_E2E_CLAUDE_REPLY` : aucun processus `claude`).
 */
const GENESIS = 'Projet démo : application de notes'

function withLot(repo: string): void {
  mkdirSync(join(repo, 'docs', 'brainstorm'), { recursive: true })
  writeFileSync(
    join(repo, 'docs', 'brainstorm', 'L1-tri.md'),
    '# L1 — Tri\n\n**Maturité** : complet · **Tâches** : docs/TACHES-TRI.md\n'
  )
  writeFileSync(
    join(repo, 'docs', 'TACHES-TRI.md'),
    '# Tâches — Tri\n\n## Lot 1\n\n- [ ] T001 Trier par date (src/a.ts)\n- [ ] T002 Trier par titre (src/a.ts)\n'
  )
  execFileSync('git', ['add', 'docs/brainstorm/L1-tri.md', 'docs/TACHES-TRI.md'], { cwd: repo })
  execFileSync('git', ['commit', '-q', '-m', 'docs: lot du tri'], { cwd: repo })
}

describe('le PO cadre un lot (T021, T023, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => {
      const repo = buildScenario(DEMO_PROJECT, 'trois-auteurs')
      withLot(repo)
      return repo
    })
    const reply = join(tmpdir(), 'gi-e2e-reponse-lot.json')
    writeFileSync(reply, '{}')
    run = await launchApp({ GI_E2E_CLAUDE_REPLY: reply })
    await run.page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_show_the_po_routing_of_every_task_then_let_mentalyas_reroute_one', async () => {
    const { page } = run
    await page.evaluate(async () => {
      const api = (globalThis as unknown as { api: { invoke(channel: string, payload: unknown): Promise<unknown> } })
        .api
      for (const [name, role] of [
        ['Chef de produit', 'po'],
        ['Développeur', 'backend'],
        ['Qualité', 'qa']
      ] as const) {
        await api.invoke('agents:save', {
          name,
          role,
          instructions: '',
          permissionMode: 'bypassPermissions',
          model: 'claude-sonnet-5-5',
          effort: 'low',
          skills: []
        })
      }
    })
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    const lot = page.getByLabel(/^Rond Lot 1/)
    await settled(lot)
    const call = async (profile: string): Promise<void> => {
      await lot.click({ button: 'right', force: true })
      // L1o D26 : « Appeler un agent… » ouvre le tiroir ; un clic sur sa carte le connecte au nœud.
      await page.getByRole('menuitem', { name: 'Appeler un agent…' }).click()
      await page.getByRole('button', { name: `Connecter ${profile}` }).click()
      await page.getByRole('button', { name: new RegExp(`^${profile}, à lancer`) }).waitFor()
    }
    // Le PO seul cadre le lot. Il est appelé depuis le vide (L1o D26) : on le glisse du tiroir sur la carte, où il est
    // posé libre, puis on tire un lien de lui vers le rond du lot.
    const lotBox = await settled(lot)
    const spot = { x: Math.max(80, lotBox.x - 260), y: lotBox.y + lotBox.height / 2 }
    await page.mouse.click(spot.x, spot.y, { button: 'right' })
    await page.getByRole('menuitem', { name: 'Appeler un agent…' }).click()
    const tray = page.getByRole('dialog', { name: 'Appeler un agent' })
    await tray.waitFor()
    await run.shot('t030-01-tiroir')
    const card = await settled(tray.getByRole('button', { name: 'Poser Chef de produit' }))
    const empty = { x: (page.viewportSize()?.width ?? 1264) - 360, y: 200 }
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
    await page.mouse.down()
    await page.mouse.move(empty.x, empty.y, { steps: 16 })
    await page.mouse.up()
    const free = page.getByRole('group', { name: /^Chef de produit, agent libre/ })
    await free.waitFor()
    await run.shot('t030-02-agent-libre')
    const handle = free.locator('.agent-bench-handle')
    const from = await settled(handle)
    const to = await settled(lot)
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.getByRole('button', { name: /^Chef de produit, à lancer/ }).waitFor()
    await free.waitFor({ state: 'detached' })
    await lot.click({ button: 'right', force: true })
    await page.getByRole('menuitem', { name: /Gérer les agents/ }).click()
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    const tab = panel.getByTestId('agents-tab')
    await tab.getByRole('button', { name: 'Lancer', exact: true }).click()
    const routing = tab.getByRole('region', { name: 'Aiguillage du lot' })
    await routing.waitFor({ timeout: 60_000 })
    await routing.getByText('Le PO conseille : une à une — tâches simulées').waitFor()
    // Ni Développeur ni Qualité dans l'équipe : signalés pour chaque tâche.
    await expect.poll(() => routing.getByText(/Pas dans l’équipe : Développeur, Qualité/).count()).toBe(2)
    await run.shot('t023-01-plan-du-po')

    // L'équipe complète : l'aiguillage du PO se lit en agents de l'équipe.
    await call('Développeur')
    await call('Qualité')
    await expect.poll(() => routing.getByText('Qualité attend Développeur').count()).toBe(2)
    expect(await routing.getByText(/Pas dans l’équipe/).count()).toBe(0)

    // Retouche de T002 : le QA n'y intervient plus ; « Rendre au PO » efface la retouche.
    await routing.getByRole('button', { name: 'Modifier' }).nth(1).click()
    await routing.getByRole('checkbox', { name: 'Qualité', exact: true }).uncheck()
    await routing.getByRole('button', { name: 'Enregistrer' }).click()
    await routing.getByText('retouché').waitFor()
    expect(await routing.getByText('Qualité attend Développeur').count()).toBe(1)
    await run.shot('t023-02-retouche')
    await routing.getByRole('button', { name: 'Rendre au PO' }).click()
    await expect.poll(() => routing.getByText('Qualité attend Développeur').count()).toBe(2)
  })
})
