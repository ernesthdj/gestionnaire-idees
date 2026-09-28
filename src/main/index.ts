import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { app, globalShortcut, Notification } from 'electron'
import { bootstrap, type AppContext } from './bootstrap'
import { seedDemo } from './infrastructure/db/demo/seedDemo'
import { GlobalShortcut } from './shell/GlobalShortcut'
import { loginItemSettings, startsHidden } from './shell/lifecycle'
import { TrayController } from './shell/TrayController'
import { WindowManager } from './shell/WindowManager'

// Profil de démonstration (développement uniquement) : données FICTIVES dans un dossier séparé, jamais le vrai profil.
const demoProfile = !app.isPackaged && process.argv.includes('--demo')
const demoData = join(app.getPath('appData'), 'gestionnaire-idees-demo')
if (demoProfile) app.setPath('userData', demoData)

/** `--reset` : repartir d'un jeu de démonstration neuf (uniquement ce dossier fictif, jamais le vrai profil). */
function resetDemoProfile(): void {
  if (!demoProfile || !process.argv.includes('--reset')) return
  for (const entry of ['gestionnaire-idees.db', 'gestionnaire-idees.db-wal', 'gestionnaire-idees.db-shm']) {
    rmSync(join(demoData, entry), { force: true })
  }
}

// Refuse toute création de webview et toute demande de permission (caméra, micro, notifications web…).
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  contents.session.setPermissionCheckHandler(() => false)
})

/** Démarrage avec Windows : seulement pour l'app installée (en développement, cela enregistrerait electron.exe). */
function applyLaunchAtLogin(enabled: boolean): void {
  if (app.isPackaged) app.setLoginItemSettings(loginItemSettings(enabled))
}

function start(): void {
  // Après l'obtention de l'instance unique : aucune autre app démo n'a la base ouverte.
  resetDemoProfile()
  const windows = new WindowManager()
  let context: AppContext | undefined
  let tray: TrayController | undefined

  const showCapture = (): void => windows.showCapture({ theme: context?.appSettings.get().theme ?? 'system' })
  const shortcut = new GlobalShortcut(globalShortcut, showCapture)

  app.on('second-instance', () => windows.showMain())
  app.on('before-quit', () => windows.setQuitting())
  // L'app vit dans la zone de notification : fermer la dernière fenêtre ne la quitte pas.
  app.on('window-all-closed', () => undefined)
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    tray?.destroy()
    context?.stop()
    context?.database.close()
  })

  void app.whenReady().then(() => {
    context = bootstrap({
      sendToMain: (event, payload) => windows.sendToMain(event, payload),
      replaceShortcut: (accelerator) => shortcut.replace(accelerator),
      applyLaunchAtLogin,
      hideCapture: () => windows.hideCapture(),
      openDive: (rootId) => {
        windows.hideCapture()
        windows.showMain({ section: 'ideas', diveRootId: rootId })
      }
    })
    if (demoProfile && seedDemo(context.database.db).seeded) context.logger.info('demo.seeded', {})

    const settings = context.appSettings.get()
    applyLaunchAtLogin(settings.launchAtLogin)
    if (!shortcut.replace(settings.shortcut)) {
      // Raccourci pris par une autre application : l'app reste utilisable via la zone de notification.
      context.logger.warn('shortcut.unavailable', {})
      new Notification({
        title: 'Raccourci de capture indisponible',
        body: `${settings.shortcut} est déjà utilisé. Choisis-en un autre dans les réglages.`
      }).show()
      windows.sendToMain('shortcut:unavailable', { shortcut: settings.shortcut })
    }

    tray = new TrayController({
      capture: showCapture,
      open: () => windows.showMain(),
      openPending: () => windows.showMain({ section: 'pending' }),
      quit: () => app.quit()
    })
    windows.preloadCapture()
    if (!startsHidden(process.argv)) windows.showMain()
  })
}

// Une seule instance : une deuxième ouverture ramène simplement la fenêtre existante au premier plan.
if (app.requestSingleInstanceLock()) start()
else app.quit()
