import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Locator, type Page } from 'playwright-core'

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

/** `env` : options du profil e2e (`GI_E2E_VAULT`, `GI_E2E_EMPTY`, `GI_E2E_KEEP`, lues seulement avec `--e2e`). */
export async function launchApp(env: Readonly<Record<string, string>> = {}): Promise<LaunchedApp> {
  const app = await electron.launch({
    executablePath: ELECTRON,
    args: [ROOT, '--e2e'],
    cwd: ROOT,
    env: { ...(process.env as Record<string, string>), GI_E2E_PROJECT: DEMO_PROJECT, ...env },
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

/**
 * Position d'un élément une fois immobile : la carte fait glisser ses nœuds après une ouverture, une bascule de vue ou
 * un widget posé. Trois mesures identiques de suite (toutes les 100 ms) avant de mesurer ou de cliquer ; 10 s au plus.
 */
export async function settled(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const deadline = Date.now() + 10_000
  let last = ''
  let same = 0
  while (Date.now() < deadline) {
    const box = await locator.boundingBox()
    const key =
      box === null ? '' : `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`
    same = key !== '' && key === last ? same + 1 : 0
    if (box !== null && same >= 2) return box
    last = key
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error('élément toujours en mouvement (ou absent) après 10 s')
}

/** Ouvre le menu du projet de la barre fine (spec 033 D3), s'il ne l'est pas déjà. */
export async function openProjectMenu(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Projet .+ : menu$/ })
  await toggle.waitFor({ timeout: 60_000 })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}

/** Retour au Project Manager depuis le canevas d'un projet (menu du projet, spec 033 D3). */
export async function backToProjects(page: Page): Promise<void> {
  await openProjectMenu(page)
  await page.getByRole('button', { name: '← Tous les projets' }).click()
}
