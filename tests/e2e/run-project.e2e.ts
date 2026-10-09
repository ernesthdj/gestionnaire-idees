import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshProfile, launchApp, type LaunchedApp } from './support/app'

/**
 * Spec 025 dans l'app réelle : un projet fictif avec un script `dev` qui écrit « serveur pret » puis tourne ; lui faire
 * confiance (confirmé), le lancer d'un clic, lire la sortie, l'arrêter ; puis F5 / Maj+F5 (touches envoyées à l'app par
 * Playwright, jamais au clavier de Windows).
 */
const DIR = join(tmpdir(), 'gi-e2e-lancer')

describe('lancer un projet depuis l’app (spec 025, e2e)', () => {
  let run: LaunchedApp

  beforeAll(async () => {
    rmSync(DIR, { recursive: true, force: true })
    freshProfile(() => {
      mkdirSync(DIR, { recursive: true })
      writeFileSync(
        join(DIR, 'package.json'),
        JSON.stringify({
          name: 'projet-fictif',
          private: true,
          scripts: {
            dev: 'node -e "console.log(\'serveur pret sur http://localhost:5173/\'); setInterval(() => {}, 1000)"',
            build: 'node -e "console.log(\'construit\')"'
          }
        })
      )
    })
    run = await launchApp({ GI_E2E_PROJECT: DIR })
    await run.page.getByRole('button', { name: 'Ouvrir Projet démo : application de notes' }).click()
  })
  afterAll(async () => {
    await run?.close()
    rmSync(DIR, { recursive: true, force: true })
  })

  it('should_trust_the_project_then_run_and_stop_its_dev_script', async () => {
    const { page } = run
    await page.getByRole('button', { name: '🔒 Lancer…' }).click()
    await page.getByRole('dialog', { name: 'Faire confiance à ce projet' }).waitFor()
    await page.getByRole('button', { name: 'Faire confiance', exact: true }).click()
    await page.getByRole('button', { name: 'Lancer le script dev' }).click()
    const log = page.getByRole('log', { name: 'Sortie de gi-e2e-lancer · dev' })
    await log.getByText('serveur pret').waitFor({ timeout: 30_000 })
    await run.shot('025-01-dev-en-cours')
    // « Ouvrir dans le navigateur » : l'ouverture réelle est remplacée dans le main (aucune fenêtre sur le bureau).
    await run.app.evaluate(({ shell }) => {
      const store = globalThis as unknown as { opened?: string[] }
      store.opened = []
      shell.openExternal = (async (url: string) => {
        store.opened?.push(url)
      }) as typeof shell.openExternal
    })
    await page.getByRole('button', { name: '🌐 Ouvrir http://localhost:5173/' }).click()
    await expect
      .poll(() => run.app.evaluate(() => (globalThis as unknown as { opened?: string[] }).opened ?? []))
      .toEqual(['http://localhost:5173/'])
    await page.getByRole('button', { name: 'Arrêter le script dev' }).click()
    await log.getByText(/— arrêté/).waitFor({ timeout: 30_000 })
    await run.shot('025-02-arrete')
  })

  it('should_start_with_f5_and_stop_with_shift_f5', async () => {
    const { page } = run
    await page.getByRole('button', { name: 'Fermer l’onglet' }).click()
    await page.keyboard.press('F5')
    await page
      .getByRole('log', { name: 'Sortie de gi-e2e-lancer · dev' })
      .getByText('serveur pret')
      .waitFor({ timeout: 30_000 })
    await page.keyboard.press('Shift+F5')
    await page.getByText(/— arrêté/).waitFor({ timeout: 30_000 })
  })
})
