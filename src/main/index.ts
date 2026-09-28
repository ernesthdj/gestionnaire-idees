import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { bootstrap, type AppContext } from './bootstrap'

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  window.once('ready-to-show', () => window.show())

  // Aucune fenêtre ni navigation externe : les liens http(s) s'ouvrent dans le navigateur système.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl === undefined || !url.startsWith(devUrl)) event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl !== undefined) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
  return window
}

// Refuse toute création de webview et toute demande de permission (caméra, micro, notifications web…).
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
})

let context: AppContext | undefined

void app.whenReady().then(() => {
  context = bootstrap()
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('will-quit', () => context?.database.close())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
