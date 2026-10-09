import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core'

/**
 * Lancement de l'app pour les tests de bout en bout : build de `out/` (fait par `npm run e2e`), profil FICTIF
 * `%APPDATA%/gestionnaire-idees-e2e` effacé avant chaque lancement (jamais le profil réel), Electron piloté par
 * Playwright (protocole de l'app, aucune touche envoyée au système).
 */

export const ROOT = resolve(import.meta.dirname, '../../..')
export const PROFILE = join(process.env['APPDATA'] ?? join(ROOT, '.e2e-appdata'), 'gestionnaire-idees-e2e')
/**
 * Dossier du projet du genesis « Projet démo : application de notes », HORS du profil : l'app refuse git dans son
 * dossier de données (spec 021). Passé à l'app par `GI_E2E_PROJECT` (lu seulement avec `--e2e`).
 */
export const DEMO_PROJECT = join(tmpdir(), 'gi-e2e-projet')
export const SHOTS = join(ROOT, 'test-results', 'e2e')

const ELECTRON = join(
  ROOT,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
)

/** Profil vierge ; `prepare` peut écrire des fichiers (dont `projet-demo/`) avant le lancement. */
export function freshProfile(prepare?: () => void): void {
  rmSync(PROFILE, { recursive: true, force: true })
  rmSync(DEMO_PROJECT, { recursive: true, force: true })
  mkdirSync(PROFILE, { recursive: true })
  mkdirSync(SHOTS, { recursive: true })
  prepare?.()
}

export interface LaunchedApp {
  readonly app: ElectronApplication
  readonly page: Page
  shot(name: string): Promise<string>
  close(): Promise<void>
}

/** Fenêtre principale (`index.html`), pas la fenêtre de capture rapide (`capture.html`). */
async function mainWindow(app: ElectronApplication): Promise<Page> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const page = app
      .windows()
      .find((window) => /\/index\.html(\?|#|$)/.test(window.url()) || /:\d+\/?$/.test(window.url()))
    if (page !== undefined) return page
    await new Promise((done) => setTimeout(done, 250))
  }
  throw new Error(
    `fenêtre principale introuvable : ${app
      .windows()
      .map((window) => window.url())
      .join(', ')}`
  )
}

export async function launchApp(): Promise<LaunchedApp> {
  const app = await electron.launch({
    executablePath: ELECTRON,
    args: [ROOT, '--e2e'],
    cwd: ROOT,
    env: { ...(process.env as Record<string, string>), GI_E2E_PROJECT: DEMO_PROJECT },
    timeout: 60_000
  })
  try {
    const page = await mainWindow(app)
    await page.waitForLoadState('domcontentloaded')
    // La carte est prête quand la navigation principale est là.
    await page.getByRole('navigation', { name: 'Navigation principale' }).waitFor({ timeout: 60_000 })
    return {
      app,
      page,
      async shot(name) {
        const path = join(SHOTS, `${name}.png`)
        await page.screenshot({ path })
        return path
      },
      async close() {
        await app.close().catch(() => undefined)
      }
    }
  } catch (error) {
    // Jamais d'instance orpheline : elle garderait le verrou du profil e2e.
    await app.close().catch(() => undefined)
    throw error
  }
}
