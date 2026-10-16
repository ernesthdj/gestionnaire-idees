import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario } from '../support/gitRepos'
import { DEMO_PROJECT, freshProfile, launchApp, settled, type LaunchedApp } from './support/app'

/**
 * Agents en nœuds du canevas (docs/TACHES-AGENTS.md T006, T008 ; L1o D10, D13, D14) dans l'app réelle : sur une tâche
 * de la vue Workflow, un clic droit appelle un PO, un développeur et un QA ; on les met à la suite les uns des autres, on
 * lance : les chambres passent d'« à lancer » à « au travail » puis « validé » (vert), et l'accord de fusion les fait
 * « fusionné ». Les sessions des agents sont simulées (`GI_E2E_CLAUDE_REPLY` : aucun processus `claude` n'est lancé).
 */
const GENESIS = 'Projet démo : application de notes'
const TASK = 'Trier la liste par date'
const NEXT_TASK = 'Trier aussi par titre'

/** Un brainstorm complet et son fichier de tâches, commités : la tâche est un carré du Workflow (spec 032 Q10). */
function withTaskFile(repo: string): void {
  mkdirSync(join(repo, 'docs', 'brainstorm'), { recursive: true })
  writeFileSync(
    join(repo, 'docs', 'brainstorm', 'L1-tri.md'),
    '# L1 — Tri\n\n**Maturité** : complet · **Tâches** : docs/TACHES-TRI.md\n'
  )
  writeFileSync(
    join(repo, 'docs', 'TACHES-TRI.md'),
    `# Tâches — Tri\n\n## Lot 1\n\n- [ ] T001 ${TASK} (src/a.ts)\n- [ ] T002 ${NEXT_TASK} (src/a.ts)\n`
  )
  execFileSync('git', ['add', 'docs/brainstorm/L1-tri.md', 'docs/TACHES-TRI.md'], { cwd: repo })
  execFileSync('git', ['commit', '-q', '-m', 'docs: tâches du tri'], { cwd: repo })
}

describe('agents en nœuds du canevas (T006, e2e)', () => {
  let run: LaunchedApp
  let projectRepo = ''

  beforeAll(async () => {
    freshProfile(() => {
      const repo = buildScenario(DEMO_PROJECT, 'trois-auteurs')
      withTaskFile(repo)
      projectRepo = repo
      return repo
    })
    const reply = join(tmpdir(), 'gi-e2e-reponse-agents.json')
    writeFileSync(reply, '{}')
    run = await launchApp({ GI_E2E_CLAUDE_REPLY: reply })
    await run.page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_draw_the_agents_under_the_node_link_them_and_follow_the_work_up_to_the_green_merge', async () => {
    const { page } = run
    // Trois profils, un par rôle (liste fermée), sans demande de permission pour ne pas avoir d'avertissement à lire.
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
    // Les agents se connectent aux nœuds du Workflow (L1o D14) : un clic droit sur la tâche les appelle.
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    const square = page.getByLabel(new RegExp(`^Carré (T001 · )?${TASK}`))
    await settled(square)
    const call = async (profile: string): Promise<void> => {
      await square.click({ button: 'right', force: true })
      // L1o D26 : « Appeler un agent… » ouvre le tiroir ; un clic sur sa carte le connecte au nœud.
      await page.getByRole('menuitem', { name: 'Appeler un agent…' }).click()
      await page.getByRole('button', { name: `Connecter ${profile}` }).click()
      await page.getByRole('button', { name: new RegExp(`^${profile}, à lancer`) }).waitFor()
    }
    await call('Chef de produit')
    await call('Développeur')
    await call('Qualité')
    await run.shot('t008-00-clic-droit')
    await square.click({ button: 'right', force: true })
    await page.getByRole('menuitem', { name: /Gérer les agents/ }).click()
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    const tab = panel.getByTestId('agents-tab')
    await tab.getByRole('combobox', { name: 'Faire attendre developpeur' }).selectOption('chef-de-produit')
    await tab.getByRole('combobox', { name: 'Faire attendre qualite' }).selectOption('developpeur')

    // Les trois agents sont des nœuds de la carte, sous le genesis, en croquis (pas encore lancés).
    const po = page.getByRole('button', { name: /^Chef de produit, à lancer/ })
    const dev = page.getByRole('button', { name: /^Développeur, à lancer/ })
    const qa = page.getByRole('button', { name: /^Qualité, à lancer/ })
    // Les chambres sont grandes (L1o D13) : on recadre pour voir les trois.
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    for (const node of [po, dev, qa]) await node.waitFor()
    const [poBox, devBox, qaBox] = [await settled(po), await settled(dev), await settled(qa)]
    expect(devBox.y).toBeGreaterThan(poBox.y)
    expect(qaBox.y).toBeGreaterThan(devBox.y)
    await run.shot('t006-01-croquis')

    // Chaque agent est sa chambre-cube (L1o D13) : on la glisse où l'on veut, elle y reste.
    await page.locator('.agent-room-canvas').first().waitFor()
    await page.waitForTimeout(1500)
    await run.shot('t008-01-chambres')
    const before = await settled(qa)
    await qa.hover()
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2 + 320, before.y + before.height / 2 - 120, { steps: 8 })
    await page.mouse.up()
    await expect
      .poll(async () => Math.round((await qa.boundingBox())?.x ?? 0), { timeout: 10_000 })
      .toBeGreaterThan(Math.round(before.x) + 200)
    await expect.poll(() => qa.isVisible()).toBe(true)
    await run.shot('t008-02-deplace')

    // Un clic sur la chambre : l'agent passe en visio, son volet s'ouvre à côté de lui.
    await dev.click()
    const visio = page.getByRole('region', { name: 'Visio avec Développeur' })
    await visio.waitFor()
    await page.waitForTimeout(2500)
    await run.shot('t008-03-visio')
    // On lui parle : sa réponse arrive mot à mot dans la conversation et en sous-titres sur la visio (lot B).
    await visio.getByLabel('Message à Claude').fill('Où en es-tu ?')
    await visio.getByRole('button', { name: 'Envoyer' }).click()
    await page.locator('.agent-visio-subs').waitFor({ timeout: 15_000 })
    await page.waitForTimeout(1200)
    await run.shot('t008-04-visio-parle')
    await visio.getByText(/il me reste à relire le diff/).waitFor({ timeout: 15_000 })
    await visio.getByText('Mission et rapport').click()
    await visio.getByRole('button', { name: 'Gérer l’assemblage' }).click()
    await tab.getByRole('region', { name: 'Agent developpeur' }).waitFor()
    await visio.getByRole('button', { name: 'Raccrocher et fermer le volet' }).click()
    await visio.waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Tout afficher' }).click()

    // Lancement : les nœuds s'animent, puis passent au vert quand le QA valide.
    await tab.getByRole('button', { name: 'Lancer', exact: true }).click()
    await page.locator('.agent-running').first().waitFor({ timeout: 30_000 })
    await run.shot('t006-02-au-travail')
    await expect.poll(() => page.locator('.agent-validated').count(), { timeout: 60_000 }).toBe(3)
    await run.shot('t006-03-valide')
    // Ce qu'a fait l'agent est dans sa visio (L1o D18) : sa passe, le fichier écrit (pastille), son rapport.
    await page.getByRole('button', { name: /^Développeur, validé/ }).click()
    const work = page.getByRole('region', { name: 'Visio avec Développeur' })
    await work.getByText(/▶ Au travail : passe 1/).waitFor({ timeout: 15_000 })
    await work
      .getByText(/Ajouté : agents-e2e\//)
      .first()
      .waitFor()
    await work.getByText(/Rapport de la passe/).waitFor()
    await page.waitForTimeout(800)
    await run.shot('t008-05-travail-dans-la-visio')
    await page.keyboard.press('Escape')
    await work.waitFor({ state: 'detached' })
    // La visio a recentré la carte (elle ne dessine que ce qui est visible) : on recadre sur tous les agents.
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await tab.getByText(/3 agents sur 3 ont fini — validé par le QA/).waitFor()
    await tab
      .getByRole('region', { name: 'Agent developpeur' })
      .getByText(/Rapport simulé/)
      .waitFor()

    // Accord unique de fusion : les nœuds restent verts, cerclés « fusionné ».
    await tab.getByRole('button', { name: 'Fusionner le travail validé…' }).click()
    await tab.getByRole('button', { name: 'Accorder la fusion' }).click()
    await expect.poll(() => page.locator('.agent-merged').count(), { timeout: 30_000 }).toBe(3)
    await tab.getByText(/Fusionné sur main/).waitFor()
    // L1o D23 : la fusion a coché la tâche sur main ; la suite est proposée (pousser, ranger les branches).
    await tab.getByText(/Tâche cochée/).waitFor()
    expect(execFileSync('git', ['show', 'main:docs/TACHES-TRI.md'], { cwd: projectRepo }).toString()).toContain(
      `- [x] T001 ${TASK}`
    )
    await tab.getByRole('button', { name: 'Pousser…' }).waitFor()
    await run.shot('t006-04-fusionne')

    // Clic droit sur un agent : le renvoyer le détache du nœud (son profil reste).
    const merged = page.getByRole('button', { name: /^Qualité, fusionné/ })
    // La visio a recentré la carte : l'agent peut être sous le panneau de droite. On recadre avant le clic droit.
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await settled(merged)
    await merged.click({ button: 'right', force: true })
    await page.getByRole('menuitem', { name: /Renvoyer l’agent/ }).click()
    await merged.waitFor({ state: 'detached' })

    // Les branches des agents sont regroupées dans l'onglet Branches du Dépôt, lisibles comme « agent · tâche ».
    await page
      .getByRole('button', { name: /^Dépôt du projet : .*Ouvrir le volet Dépôt/ })
      .first()
      .click()
    const repo = page.getByRole('region', { name: 'Dépôt' })
    await repo.getByRole('tab', { name: 'Branches' }).click()
    await repo.getByText(/Branches des agents \(3\)/).click()
    await repo.getByRole('button', { name: /^Passer sur agents\/.*\/qualite$/ }).waitFor()
    await run.shot('021-branches-des-agents')
    await expect.poll(() => page.locator('.agent-node').count()).toBe(2)

    // L1o D24 : l'équipe passe à la tâche suivante ; le volet suit, l'ancienne tâche n'a plus d'agents.
    await panel.getByRole('tab', { name: /T001/ }).click()
    await tab.getByRole('button', { name: 'Déplacer l’équipe…' }).click()
    await expect.poll(() => tab.getByRole('combobox', { name: 'Vers quelle tâche ?' }).textContent()).toContain('T002')
    await run.shot('t024-01-deplacer-equipe')
    await tab.getByRole('button', { name: 'Déplacer', exact: true }).click()
    await panel.getByRole('tab', { name: /T002/ }).waitFor()
    await expect.poll(() => page.locator('.agent-node').count()).toBe(2)
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await page.waitForTimeout(800)
    await run.shot('t024-02-equipe-deplacee')
  })
})
