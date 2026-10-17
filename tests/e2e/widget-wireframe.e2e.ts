import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEMO_PROJECT, freshProfile, launchApp, settled, type LaunchedApp } from './support/app'

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

const WITH_SETTINGS = {
  title: 'Écrans réglables',
  html: '<main><h1 id="titre-ecran"></h1></main>',
  css: 'main { padding: 16px; }',
  ts: [
    'type Gi = { settings(f: unknown): void; onSettings(cb: (v: Record<string, unknown>) => void): void }',
    'const gi = (window as unknown as { gi: Gi }).gi',
    'const title = document.querySelector("#titre-ecran") as HTMLElement',
    'gi.settings([',
    '  { key: "titre", label: "Titre de l’écran", type: "text", default: "Accueil", group: "Écran" },',
    '  { key: "etat", label: "État", type: "select", options: ["Normal", "Erreur"] }',
    '])',
    'gi.onSettings((values) => { title.textContent = String(values.titre) + " · " + String(values.etat) })'
  ].join('\n'),
  summary: 'Un écran et ses réglages.'
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

    // Brancher le genesis : tirer son point d'accroche et le lâcher au milieu du widget (tout le widget l'accepte).
    const idea = page.locator('.react-flow__node').filter({ hasText: 'application de notes' }).first()
    // Le widget posé fait glisser la carte : mesurer seulement une fois tout immobile.
    await settled(idea)
    await idea.hover()
    const from = await settled(idea.locator('.neuron-connector'))
    const to = await settled(widget)
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 })
    await run.shot('026-00-lien-sur-le-widget')
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

  it('should_show_the_declared_settings_in_a_floating_panel_and_full_screen', async () => {
    writeFileSync(REPLY, JSON.stringify(WITH_SETTINGS))
    const widget = run.page.getByRole('region', { name: /^Widget IA/ })
    await widget.getByRole('button', { name: '🛠 Adapter au nœud' }).click()
    const frame = run.page.frameLocator('iframe[title="Écrans réglables"]')
    await frame.getByText('Accueil · Normal').waitFor({ timeout: 30_000 })

    const panel = run.page.getByRole('region', { name: 'Réglages · Écrans réglables' })
    await panel.getByLabel('Titre de l’écran').fill('Demande de devis')
    await panel.getByLabel('État').selectOption('Erreur')
    await frame.getByText('Demande de devis · Erreur').waitFor()
    await run.shot('026-04-panneau-reglages')

    // Après « Adapter », le widget grandit et la carte glisse : le bouton peut passer un instant sous la barre d'outils.
    await settled(widget.getByRole('button', { name: 'Plein écran' }))
    await widget.getByRole('button', { name: 'Plein écran' }).click()
    const dialog = run.page.getByRole('dialog', { name: 'Plein écran : Écrans réglables' })
    await dialog.getByRole('complementary', { name: 'Réglages' }).getByLabel('État').waitFor()
    const full = dialog.frameLocator('iframe[title="Écrans réglables"]')
    await full.getByText('Demande de devis · Erreur').waitFor()
    expect(await full.locator('html').evaluate((html) => Number(html.style.getPropertyValue('--gi-zoom')))).toBe(1)
    await run.shot('026-05-plein-ecran')
    await run.page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })

    await run.page.waitForTimeout(800)
    await run.close()
    run = await launchApp({ ...ENV, GI_E2E_KEEP: '1' })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
    await run.page
      .frameLocator('iframe[title="Écrans réglables"]')
      .getByText('Demande de devis · Erreur')
      .waitFor({ timeout: 30_000 })
  })

  it('should_fold_the_widget_into_a_tile_without_its_frame_and_keep_it_folded_after_a_restart', async () => {
    // Demande de mentalyas (2026-10-17) : un widget replié reste sur la carte en tuile, son cadre ne tourne plus.
    const widget = run.page.getByRole('region', { name: /^Widget IA/ })
    await settled(widget.getByRole('button', { name: 'Replier le widget' }))
    await widget.getByRole('button', { name: 'Replier le widget' }).click()
    const tile = run.page.getByRole('region', { name: 'Widget replié : Écrans réglables' })
    await tile.waitFor()
    expect(await run.page.locator('iframe[title="Écrans réglables"]').count()).toBe(0)
    // Son panneau de réglages se cache avec lui.
    await run.page.getByRole('region', { name: 'Réglages · Écrans réglables' }).waitFor({ state: 'detached' })
    const box = await settled(tile)
    expect(Math.round(box.width)).toBeLessThan(200)
    await run.shot('026-06-widget-replie')

    await run.page.waitForTimeout(1500)
    await run.close()
    run = await launchApp({ ...ENV, GI_E2E_KEEP: '1' })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
    const again = run.page.getByRole('region', { name: 'Widget replié : Écrans réglables' })
    await again.waitFor({ timeout: 30_000 })
    await settled(again.getByRole('button', { name: 'Déplier' }))
    await again.getByRole('button', { name: 'Déplier' }).click()
    await run.page
      .frameLocator('iframe[title="Écrans réglables"]')
      .getByText('Demande de devis · Erreur')
      .waitFor({ timeout: 30_000 })
    await run.page.getByRole('region', { name: 'Réglages · Écrans réglables' }).waitFor()
  })
})
