import { app, shell, type BrowserWindow, type WebPreferences } from 'electron'
import { join } from 'node:path'
import { WINDOW_ARG_PREFIX } from '@shared/ipc/channels'

/** Préférences communes à toutes les fenêtres : isolation, sandbox, aucun accès Node côté interface. */
export function hardenedWebPreferences(window: 'main' | 'capture'): WebPreferences {
  return {
    preload: join(import.meta.dirname, '../preload/index.cjs'),
    // Le preload n'expose que l'API de cette fenêtre.
    additionalArguments: [`${WINDOW_ARG_PREFIX}${window}`],
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true
  }
}

/** Aucune fenêtre ni navigation externe : les liens https s'ouvrent dans le navigateur système. */
export function guardNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl === undefined || !url.startsWith(devUrl)) event.preventDefault()
  })
}

/** Charge une page de l'interface : serveur de développement, ou fichiers empaquetés. */
export function loadPage(window: BrowserWindow, page: 'index' | 'capture'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl !== undefined) {
    void window.loadURL(page === 'index' ? devUrl : `${devUrl}/${page}.html`)
  } else {
    void window.loadFile(join(import.meta.dirname, `../renderer/${page}.html`))
  }
}
