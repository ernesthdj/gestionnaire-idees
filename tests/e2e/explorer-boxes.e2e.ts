import { cpSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REPRISE_FIXTURES } from '../support/reprise'
import { DEMO_PROJECT, freshProfile, launchApp, type LaunchedApp, openProjectMenu } from './support/app'

/**
 * Spec 031 lot 3 dans l'app réelle : entrer dans un module par double-clic (SC-002, mesuré image par image), passer
 * au voisin par une amorce, ressortir par Échap. Projet C# fictif lié au genesis de démo, analysé en « Local uniquement ».
 */
const GENESIS = 'Projet démo : application de notes'

/** Relevés pris dans la page toutes les 8 ms pendant une transition. */
const RECORD = `(() => {
  window.__rec = []
  const t0 = performance.now()
  const real = (id) => document.querySelector('.box-scene > .react-flow:not(.scene-ghost) .react-flow__node[data-id="' + id + '"]')
  const ghost = (id) => document.querySelector('.scene-ghost .react-flow__node[data-id="' + id + '"]')
  const tick = () => {
    const frame = real('m:dir:Domain'), file = real('f:Domain/OrderService.cs'), old = ghost('m:dir:Domain')
    if (frame && file) {
      const a = frame.getBoundingClientRect(), b = file.getBoundingClientRect()
      window.__rec.push({
        ratio: b.width / a.width,
        frame: +getComputedStyle(frame).opacity,
        box: old ? +getComputedStyle(old).opacity : null,
        ghost: !!document.querySelector('.scene-ghost'),
        label: (() => { const l = document.querySelector('.scene-title'); if (!l) return null; const r = l.getBoundingClientRect(); return [r.left, r.top, r.height] })()
      })
    }
    if (performance.now() - t0 < 1500) setTimeout(tick, 8)
  }
  tick()
  return 0
})()`

describe('explorateur en boîtes : entrer, passer, ressortir (spec 031 lot 3, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    freshProfile(() => cpSync(join(REPRISE_FIXTURES, 'cs-app'), DEMO_PROJECT, { recursive: true }))
    run = await launchApp()
    const { page } = run
    await page.getByRole('button', { name: `Ouvrir ${GENESIS}` }).click()
    await openProjectMenu(page)
    await page.getByRole('button', { name: 'Analyser le code…' }).click({ timeout: 30_000 })
    const panel = page.getByRole('region', { name: 'Analyser le code du projet' })
    await panel.getByRole('radio', { name: /Local uniquement/ }).check()
    await panel.getByRole('button', { name: 'Analyser', exact: true }).click()
    await page.getByRole('group', { name: /^module Domain,/ }).waitFor({ timeout: 90_000 })
  })
  afterAll(async () => {
    await run?.close()
  })

  it('should_grow_the_module_and_its_files_together_relay_in_crossfade_and_land_the_title', async () => {
    const { page } = run
    await page.evaluate(RECORD)
    await page.getByRole('group', { name: /^module Domain,/ }).dblclick()
    await page.getByRole('group', { name: /^intérieur du module Domain/ }).waitFor()
    await page.waitForTimeout(1600)
    const rec = (await page.evaluate('window.__rec')) as {
      ratio: number
      frame: number
      box: number | null
      ghost: boolean
      label: [number, number, number] | null
    }[]
    const moving = rec.filter((entry) => entry.ghost)
    expect(moving.length).toBeGreaterThan(10)
    // Le fichier et le cadre grandissent ensemble : leur rapport ne bouge pas.
    const ratios = moving.map((entry) => entry.ratio)
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(0.002)
    // La boîte de la carte et le cadre se relaient : leurs opacités se complètent.
    for (const entry of moving.filter((sample) => sample.box !== null)) {
      expect(Math.abs(entry.frame + (entry.box ?? 0) - 1)).toBeLessThan(0.03)
    }
    // Les fichiers sont là bien avant la fin.
    expect(moving.some((entry) => entry.frame > 0.95)).toBe(true)
    await page.locator('.scene-ghost').waitFor({ state: 'detached' })
    expect(await page.locator('.scene-title').count()).toBe(0)
    // Le titre glissé se pose exactement sur le vrai titre du cadre (au pixel près).
    const last = moving.filter((entry) => entry.label !== null).at(-1)?.label
    const title = await page
      .locator('.box-scene > .react-flow:not(.scene-ghost) .react-flow__node[data-id="m:dir:Domain"] .box-title')
      .boundingBox()
    expect(last).toBeTruthy()
    expect(Math.abs((last?.[0] ?? 0) - (title?.x ?? 0))).toBeLessThan(1.5)
    expect(Math.abs((last?.[1] ?? 0) - (title?.y ?? 0))).toBeLessThan(1.5)
    expect(Math.abs((last?.[2] ?? 0) - (title?.height ?? 0))).toBeLessThan(1.5)
    await page.getByRole('group', { name: /^fichier OrderService\.cs.*fonctions/ }).waitFor()
    await run.shot('031-lot3-01-interieur')
  })

  it('should_go_to_the_neighbour_through_a_stub_then_leave_with_escape', async () => {
    const { page } = run
    await page.getByRole('group', { name: 'appelé par le module Controllers : entrer dedans' }).click()
    await page.getByRole('group', { name: /^intérieur du module Controllers/ }).waitFor()
    await page.getByRole('group', { name: 'appelle le module Domain : entrer dedans' }).waitFor()
    await page.locator('.scene-ghost').waitFor({ state: 'detached' })
    await run.shot('031-lot3-02-amorce')
    await page.keyboard.press('Escape')
    await page.getByRole('group', { name: /^module Controllers, Entrée/ }).waitFor()
    await page.locator('.scene-ghost').waitFor({ state: 'detached' })
    expect(await page.getByRole('group', { name: /^intérieur du module/ }).count()).toBe(0)
    await run.shot('031-lot3-03-sortie')
  })

  it('should_open_a_file_in_two_gestures_with_ctrl_k_and_describe_its_module_in_words', async () => {
    const { page } = run
    // SC-001 : Ctrl+K, le nom, Entrée → dans son module, son code et sa fiche à droite.
    await page.keyboard.press('Control+K')
    await page.getByRole('combobox', { name: 'Fichier ou fonction' }).fill('sqlorder')
    await page
      .getByRole('option', { name: /SqlOrderRepository\.cs/ })
      .first()
      .waitFor()
    await run.shot('031-lot4-01-recherche')
    await page.keyboard.press('Enter')
    await page.getByRole('group', { name: /^intérieur du module Infrastructure/ }).waitFor()
    const pane = page.getByRole('complementary', { name: 'Code du fichier' })
    await pane.getByRole('region', { name: /^Code de Infrastructure\/SqlOrderRepository\.cs/ }).waitFor()
    await pane.getByRole('region', { name: 'Qui l’appelle' }).waitFor()
    await page.locator('.scene-ghost').waitFor({ state: 'detached' })
    await run.shot('031-lot4-02-fichier-trouve')

    // La fiche d'un module : ce qu'il utilise et qui l'utilise, en mots.
    await page.keyboard.press('Escape')
    await page.locator('.scene-ghost').waitFor({ state: 'detached' })
    await page.getByRole('group', { name: /^module Infrastructure,/ }).click()
    await page.getByRole('tab', { name: 'Élément' }).click()
    const element = page.getByRole('complementary', { name: 'Élément choisi' })
    await element.getByRole('region', { name: 'Utilisé par' }).getByRole('button', { name: 'Domain' }).waitFor()
    await run.shot('031-lot4-03-fiche-module')
  })
})
