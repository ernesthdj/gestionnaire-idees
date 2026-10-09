import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 026 dans l'app réelle : brancher une idée fictive sur un widget, cliquer « 🖼 Wireframe » (Claude simulé : sa
 * réponse est lue dans un fichier fictif, la demande reçue est écrite à côté), retoucher un réglage dans le widget,
 * puis rouvrir l'app et retrouver le réglage. Le contenu est mis à l'échelle du bloc.
 */
const REPLY = join(tmpdir(), 'gi-e2e-claude-widget.json')
const ENV = { GI_E2E_CLAUDE_REPLY: REPLY }

const WIREFRAME = {
  title: 'Écrans de la démo',
  html: '<main id="ecran"><label for="titre">Titre de l’écran</label><input id="titre"><h1 id="affiche"></h1><div id="large"></div></main>',
  css: 'main { padding: 16px; } #large { width: 100%; height: 40px; background: var(--color-surface-raised); }',
  ts: [
    'const gi = (window as unknown as { gi: { onState(cb: (s: unknown) => void): void; saveState(d: unknown): void } }).gi',
    'const field = document.querySelector("#titre") as HTMLInputElement',
    'const shown = document.querySelector("#affiche") as HTMLElement',
    'gi.onState((state) => {',
    '  const saved = state !== null && typeof state === "object" ? (state as { titre?: unknown }).titre : undefined',
    '  field.value = typeof saved === "string" ? saved : "Accueil"',
    '  shown.textContent = field.value',
    '})',
    'field.addEventListener("input", () => {',
    '  shown.textContent = field.value',
    '  gi.saveState({ titre: field.value })',
    '})'
  ].join('\n'),
  summary: 'Écrans : Accueil. Tiré du nœud : son titre.'
}

const widgetFrame = (run: LaunchedApp) => run.page.frameLocator('iframe[title="Écrans de la démo"]')

describe('wireframe dans un widget relié à un nœud (spec 026, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => mkdirSync(DEMO_PROJECT, { recursive: true }))
    writeFileSync(REPLY, JSON.stringify(WIREFRAME))
    run = await launchApp(ENV)
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
    await run.page.locator('.react-flow').waitFor()
  })
  afterAll(async () => {
    await run?.close()
    rmSync(REPLY, { force: true })
    rmSync(`${REPLY}.request.txt`, { force: true })
  })

  it('should_build_a_wireframe_from_the_connected_node_with_the_full_context', async () => {
    const { page } = run
    // Carte dézoomée, puis un widget posé dans le vide (clic droit), en haut à gauche.
    await page.getByRole('button', { name: 'Dézoomer' }).click()
    await page.getByRole('button', { name: 'Dézoomer' }).click()
    await page.waitForTimeout(500)
    await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 240, y: 170 } })
    await page.getByRole('menuitem', { name: /Widget IA/ }).click()
    const widget = page.getByRole('region', { name: 'Widget IA' })
    await widget.getByText(/Tire un lien d’une idée/).waitFor()

    // Brancher le genesis : tirer son point d'accroche jusqu'au widget.
    const idea = page.locator('.react-flow__node').filter({ hasText: 'application de notes' }).first()
    await idea.hover()
    const from = await idea.locator('.neuron-connector').boundingBox()
    const to = await widget.locator('.io-target').boundingBox()
    if (from === null || to === null) throw new Error('points d’accroche introuvables')
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'Plus tard' }).click()

    const builds = widget.getByRole('group', { name: 'Générer à partir du nœud branché' })
    await builds.waitFor()
    await run.shot('026-01-noeud-branche')
    await builds.getByRole('button', { name: '🖼 Wireframe' }).click()
    await widgetFrame(run).locator('#affiche').getByText('Accueil').waitFor({ timeout: 30_000 })

    const sent = readFileSync(`${REPLY}.request.txt`, 'utf8')
    expect(sent).toContain('Construction : wireframe')
    expect(sent).toContain('application de notes')
    await expect
      .poll(() =>
        page
          .getByRole('region', { name: 'Widget IA : Écrans de la démo' })
          .getByText(/🖼 Wireframe/)
          .count()
      )
      .toBeGreaterThan(0)
  })

  it('should_scale_the_content_down_to_the_block', async () => {
    const zoom = await widgetFrame(run)
      .locator('html')
      .evaluate((html) => Number(html.style.getPropertyValue('--gi-zoom')))
    // Bloc de 520 px de large, mise en page sur 760 px : le contenu est réduit d'environ un tiers.
    expect(zoom).toBeGreaterThan(0.6)
    expect(zoom).toBeLessThan(0.75)
    const overflow = await widgetFrame(run)
      .locator('html')
      .evaluate((html) => html.scrollWidth > html.clientWidth + 1)
    expect(overflow).toBe(false)
    await run.shot('026-02-wireframe-echelle')
  })

  it('should_keep_a_setting_after_the_app_is_reopened', async () => {
    await widgetFrame(run).getByLabel('Titre de l’écran').fill('Demande de devis')
    await widgetFrame(run).locator('#affiche').getByText('Demande de devis').waitFor()
    // L'état part au plus tard 500 ms après la saisie ; on laisse le temps de l'écrire.
    await run.page.waitForTimeout(1200)
    await run.close()

    run = await launchApp({ ...ENV, GI_E2E_KEEP: '1' })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
    await widgetFrame(run).locator('#affiche').getByText('Demande de devis').waitFor({ timeout: 30_000 })
    expect(await widgetFrame(run).getByLabel('Titre de l’écran').inputValue()).toBe('Demande de devis')
    await run.shot('026-03-reglage-garde')
  })
})
