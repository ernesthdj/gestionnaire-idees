import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locator } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildScenario } from '../support/gitRepos'
import { DEMO_PROJECT, freshProfile, launchApp, settled, type LaunchedApp } from './support/app'

/**
 * Spec 027 lot 1 dans l'app réelle (quickstart 1, 4, 6) : la conversation s'ouvre dans le panneau fixe de droite, qui
 * ne bouge ni ne zoome avec la carte ; le Dépôt est un onglet du même panneau ; un fichier se lit dans l'onglet de son
 * nœud, Échap revient à la conversation. Projet fictif (dépôt git + fondation) posé comme dossier du genesis de démo.
 */
const GENESIS = 'Projet démo : application de notes'

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const found = await locator.boundingBox()
  if (found === null) throw new Error('élément non affiché')
  return found
}

describe('panneau de conversation fixe (spec 027 lot 1, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => {
      buildScenario(DEMO_PROJECT, 'hook-temoin')
      mkdirSync(join(DEMO_PROJECT, 'docs'), { recursive: true })
      writeFileSync(join(DEMO_PROJECT, 'docs', 'FOUNDATION.md'), '# Fondation\n\nUne app pour noter ses idées.\n')
    })
    run = await launchApp()
    await run.page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_keep_the_conversation_still_and_readable_when_the_map_is_zoomed_or_recentred', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    const genesis = page.getByRole('group', { name: new RegExp(`: ${GENESIS},`) })
    await settled(genesis)
    await genesis.click({ force: true })
    const card = page.getByRole('dialog', { name: `Détails : ${GENESIS}` })
    await card.getByRole('button', { name: 'Discuter' }).click()
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    const chat = panel.getByRole('region', { name: `Conversation : ${GENESIS}` })
    await chat.waitFor()
    // La carte de détails n'a plus d'étirement de droite : la conversation n'y est pas.
    expect(await card.getByLabel('Message à Claude').count()).toBe(0)
    const before = await box(panel)
    const field = await box(panel.getByLabel('Message à Claude'))
    await run.shot('027-01-panneau-ouvert')
    for (let index = 0; index < 4; index += 1) await page.getByRole('button', { name: 'Dézoomer' }).click()
    await page.waitForTimeout(600)
    await run.shot('027-02-carte-dezoomee')
    expect(await box(panel)).toEqual(before)
    expect(await box(panel.getByLabel('Message à Claude'))).toEqual(field)
    await page.getByRole('button', { name: 'Recentrer' }).click()
    await page.getByRole('button', { name: 'Zoomer', exact: true }).click()
    await page.waitForTimeout(600)
    expect(await box(panel)).toEqual(before)
    // Le texte reste à sa taille normale (14 px), quel que soit le zoom.
    const fontSize = await panel
      .locator('.side-panel-content')
      .evaluate(
        (element) =>
          (globalThis as unknown as { getComputedStyle(node: unknown): { fontSize: string } }).getComputedStyle(element)
            .fontSize
      )
    expect(fontSize).toBe('14px')
    // Fermer la carte ne ferme pas l'onglet.
    await card.getByRole('button', { name: 'Fermer la carte' }).click()
    await chat.waitFor()
  })

  it('should_open_the_repo_as_a_tab_and_close_it_with_the_shortcut_keeping_the_chats', async () => {
    const { page } = run
    const badge = page.getByRole('button', { name: /^Dépôt : ⎇ main/ })
    await badge.waitFor({ timeout: 30_000 })
    await badge.evaluate((element) => (element as unknown as { click(): void }).click())
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    await panel.getByRole('region', { name: 'Dépôt' }).waitFor()
    expect(await panel.getByRole('tab', { name: /⎇ Dépôt/ }).getAttribute('aria-selected')).toBe('true')
    expect(await panel.getByRole('tab', { name: new RegExp(GENESIS) }).count()).toBe(1)
    await run.shot('027-03-onglet-depot')
    await page.keyboard.press('Control+Shift+G')
    await expect.poll(() => panel.getByRole('tab', { name: /⎇ Dépôt/ }).count()).toBe(0)
    await panel.getByRole('region', { name: `Conversation : ${GENESIS}` }).waitFor()
  })

  it('should_read_a_file_in_the_node_tab_and_go_back_with_escape', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    const genesis = page.getByRole('group', { name: new RegExp(`: ${GENESIS},`) })
    await settled(genesis)
    await genesis.click({ force: true })
    const card = page.getByRole('dialog', { name: `Détails : ${GENESIS}` })
    await card.getByRole('button', { name: 'Lire la fondation' }).click()
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    const reader = panel.getByRole('region', { name: 'docs/FOUNDATION.md' })
    await reader.waitFor()
    await panel.getByText('Une app pour noter ses idées.').waitFor()
    await run.shot('027-04-lecteur-dans-l-onglet')
    await reader.getByRole('button', { name: 'Fermer le fichier' }).focus()
    await page.keyboard.press('Escape')
    await panel.getByRole('region', { name: `Conversation : ${GENESIS}` }).waitFor()
    expect(await reader.count()).toBe(0)
    // Échap ensuite rend le focus à la carte, sans fermer l'onglet.
    await panel.getByLabel('Message à Claude').focus()
    await page.keyboard.press('Escape')
    await expect
      .poll(() =>
        page.evaluate(() => {
          const active = (
            globalThis as unknown as { document: { activeElement: { closest(selector: string): unknown } | null } }
          ).document.activeElement
          return active?.closest('.react-flow__node') !== null && active !== null
        })
      )
      .toBe(true)
    expect(await panel.getByRole('tab', { name: new RegExp(GENESIS) }).count()).toBe(1)
    await run.shot('027-05-retour-conversation')
  })

  it('should_flag_a_permission_request_on_the_hidden_tab_and_on_its_node', async () => {
    const { page, app } = run
    await page.getByRole('button', { name: 'Progression', exact: true }).click()
    await page.getByRole('button', { name: 'Tout afficher' }).click()
    // Deuxième conversation : l'élément « Données » de la carte de structure (sa carte, puis « Discuter »). Les nœuds
    // glissent vers leur place après la bascule de vue : on attend qu'il s'arrête avant de cliquer.
    const donnees = page.getByRole('group', { name: /module « Données »/ })
    await settled(donnees)
    await donnees.click({ force: true })
    await page.getByRole('dialog', { name: 'Détails : Données' }).getByRole('button', { name: 'Discuter' }).click()
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    await panel.getByRole('tab', { name: /Données/ }).waitFor()
    expect(await panel.getByRole('tab').count()).toBe(2)
    const genesisId = await page
      .locator('.react-flow__node')
      .filter({ hasText: GENESIS })
      .first()
      .getAttribute('data-id')
    if (genesisId === null) throw new Error('nœud du genesis introuvable')
    // Demande de permission dans la conversation non affichée, par le même canal que le vrai Claude (main → fenêtre).
    const send = (channel: string, payload: unknown): Promise<void> =>
      app.evaluate(
        ({ BrowserWindow }, [name, data]) => {
          const main = BrowserWindow.getAllWindows().find((window) => !window.webContents.getURL().includes('capture'))
          main?.webContents.send(name as string, data)
        },
        [channel, payload] as const
      )
    await send('chat:permission', {
      id: 'e2e-demande',
      neuronId: genesisId,
      tool: 'Bash',
      detail: { kind: 'command', command: 'npm test' },
      at: new Date().toISOString()
    })
    await page.getByText('⏸ attend ton accord').first().waitFor()
    await panel.getByRole('tab', { name: `${GENESIS} (attend ton accord)` }).waitFor()
    await run.shot('027-06-attente-sur-l-onglet')
    await send('chat:permissionResolved', { neuronId: genesisId, requestId: 'e2e-demande' })
    await expect.poll(() => panel.getByRole('tab', { name: /attend ton accord/ }).count()).toBe(0)
    // Suppr ferme l'onglet affiché : la conversation du genesis s'affiche.
    await panel.getByRole('tab', { name: /Données/ }).focus()
    await page.keyboard.press('Delete')
    await panel.getByRole('region', { name: `Conversation : ${GENESIS}` }).waitFor()
  })

  it('should_bring_the_ringed_node_back_to_the_centre_even_from_another_view', async () => {
    const { page } = run
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    const node = page.getByRole('group', { name: /module « Données »/ })
    await settled(node)
    await node.click({ force: true })
    await page.getByRole('dialog', { name: 'Détails : Données' }).getByRole('button', { name: 'Discuter' }).click()
    await panel.getByRole('tab', { name: /Données/ }).waitFor()
    // L'anneau « conversation ouverte » est sur le seul nœud de l'onglet affiché.
    await expect.poll(() => page.locator('.living[data-chat="true"]').count()).toBe(1)
    expect(await node.locator('.living').getAttribute('data-chat')).toBe('true')
    // La carte part loin : le nœud sort de l'écran.
    const map = await box(page.locator('.react-flow'))
    const centre = { x: map.x + map.width / 2, y: map.y + map.height / 2 }
    await page.mouse.move(map.x + 40, map.y + 40)
    await page.mouse.down()
    await page.mouse.move(map.x + 40 - 900, map.y + 40 - 700, { steps: 10 })
    await page.mouse.up()
    // React Flow ne dessine que les nœuds visibles : hors de l'écran, le nœud n'est plus dans la page.
    await expect.poll(() => node.count()).toBe(0)
    await panel.getByRole('button', { name: 'Centrer sur le nœud' }).click()
    const near = async (): Promise<number> => {
      const found = await box(node.locator('.living-face'))
      return Math.hypot(found.x + found.width / 2 - centre.x, found.y + found.height / 2 - centre.y)
    }
    await expect.poll(near, { timeout: 5000 }).toBeLessThan(40)
    await run.shot('027-07-noeud-recentre')
    // Vue Workflow affichée : l'élément n'y est pas dessiné ; « Centrer » rebascule en Progression, puis centre.
    await page.getByRole('button', { name: 'Workflow', exact: true }).click()
    await expect.poll(() => node.count()).toBe(0)
    await panel.getByRole('button', { name: 'Centrer sur le nœud' }).click()
    await node.waitFor()
    await expect.poll(near, { timeout: 8000 }).toBeLessThan(40)
    expect(await page.getByRole('button', { name: 'Progression', exact: true }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    await run.shot('027-08-vue-rebasculee')
  })

  it('should_resize_the_panel_with_the_mouse_and_the_keyboard_and_keep_the_width_after_a_restart', async () => {
    const panel = (): Locator => run.page.getByRole('complementary', { name: 'Panneau de droite' })
    // Part du panneau dans sa ligne (carte + panneau), en %.
    const share = async (): Promise<number> =>
      panel().evaluate((element) => {
        const node = element as unknown as {
          getBoundingClientRect(): { width: number }
          parentElement: { getBoundingClientRect(): { width: number } } | null
        }
        return Math.round(
          (node.getBoundingClientRect().width / (node.parentElement?.getBoundingClientRect().width ?? 1)) * 100
        )
      })
    expect(await share()).toBe(38)
    const handle = panel().getByRole('separator', { name: 'Largeur du panneau' })
    const grip = await box(handle)
    const row = await box(panel().locator('xpath=..'))
    await run.page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await run.page.mouse.down()
    await run.page.mouse.move(row.x + row.width * 0.5, grip.y + grip.height / 2, { steps: 12 })
    await run.page.mouse.up()
    await expect.poll(share).toBe(50)
    expect(await handle.getAttribute('aria-valuenow')).toBe('50')
    await handle.focus()
    for (let index = 0; index < 3; index += 1) await run.page.keyboard.press('ArrowRight')
    await expect.poll(share).toBe(44)
    await run.shot('027-09-largeur-reglee')
    // Enregistrée après la suite de touches, gardée à la relance de l'app.
    await run.page.waitForTimeout(800)
    await run.close()
    run = await launchApp({ GI_E2E_KEEP: '1' })
    await run.page
      .getByRole('button', { name: new RegExp(`(Ouvrir|Reprendre « )${GENESIS}`) })
      .first()
      .click()
    await run.page.getByRole('button', { name: 'Tout afficher' }).click()
    await run.page.waitForTimeout(1000)
    if ((await panel().count()) === 0) {
      await run.page.getByRole('group', { name: new RegExp(`: ${GENESIS},`) }).click({ force: true })
      await run.page
        .getByRole('dialog', { name: `Détails : ${GENESIS}` })
        .getByRole('button', { name: 'Discuter' })
        .click()
    }
    await panel().waitFor()
    await expect.poll(share).toBe(44)
  })

  it('should_lay_the_panel_over_the_map_in_a_narrow_window_and_mask_it', async () => {
    const { page, app } = run
    await app.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find((window) => !window.webContents.getURL().includes('capture'))
      main?.setSize(1000, 760)
    })
    const panel = page.getByRole('complementary', { name: 'Panneau de droite' })
    await expect.poll(async () => (await panel.getAttribute('class')) ?? '').toContain('side-panel-overlay')
    await run.shot('027-10-fenetre-etroite')
    await panel.getByRole('button', { name: 'Masquer le panneau' }).click()
    await expect.poll(() => panel.count()).toBe(0)
    await page.getByRole('button', { name: /Panneau \(\d+\)/ }).click()
    await panel.waitFor()
  })
})
