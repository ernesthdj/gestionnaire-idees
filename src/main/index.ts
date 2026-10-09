import { rmSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { app, globalShortcut, Notification, session } from 'electron'
import { bootstrap, type AppContext } from './bootstrap'
import { writeDemoMethodFolder } from './infrastructure/db/demo/demoMethod'
import { DEFAULT_DEMO_SIZE, seedDemo } from './infrastructure/db/demo/seedDemo'
import { GlobalShortcut } from './shell/GlobalShortcut'
import { loginItemSettings, startsHidden } from './shell/lifecycle'
import { TrayController } from './shell/TrayController'
import { WindowManager } from './shell/WindowManager'
import { installWidgetProtocol, registerWidgetScheme } from './shell/widgetProtocol'

// Protocole isolé des widgets (spec 004) : à déclarer avant que l'app soit prête.
registerWidgetScheme()

// Profil de démonstration (développement uniquement) : données FICTIVES dans un dossier séparé, jamais le vrai profil.
// Profil d'essai d'une mise à jour de l'Analyste (spec 019 D13) : recréé et semé de données fictives à chaque lancement.
// Profil des tests de bout en bout (`npm run e2e`) : données fictives, base recréée à chaque lancement.
const trialProfile = !app.isPackaged && process.argv.includes('--essai')
const e2eProfile = !app.isPackaged && process.argv.includes('--e2e')
const demoProfile = !app.isPackaged && (trialProfile || e2eProfile || process.argv.includes('--demo'))
const demoData = join(
  app.getPath('appData'),
  e2eProfile ? 'gestionnaire-idees-e2e' : trialProfile ? 'gestionnaire-idees-essai' : 'gestionnaire-idees-demo'
)
if (demoProfile) app.setPath('userData', demoData)

/** `--reset` : repartir d'un jeu de démonstration neuf (uniquement ce dossier fictif, jamais le vrai profil). */
function resetDemoProfile(): void {
  if (!demoProfile || !(trialProfile || e2eProfile || process.argv.includes('--reset'))) return
  // Tests e2e de reprise (spec 024) : la base de la passe précédente est gardée.
  if (e2eProfile && process.env['GI_E2E_KEEP'] === '1') return
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

  // Tests e2e : Claude simulé (réponse lue dans un fichier fictif), jamais hors du profil e2e de développement.
  const e2eReply = e2eProfile ? process.env['GI_E2E_CLAUDE_REPLY'] : undefined
  const e2eClaudeReply = e2eReply !== undefined && isAbsolute(e2eReply) ? e2eReply : undefined
  void app.whenReady().then(() => {
    context = bootstrap(
      {
        sendToMain: (event, payload) => windows.sendToMain(event, payload),
        replaceShortcut: (accelerator) => shortcut.replace(accelerator),
        applyLaunchAtLogin,
        hideCapture: () => windows.hideCapture(),
        openDive: (rootId) => {
          windows.hideCapture()
          windows.showMain({ section: 'ideas', diveRootId: rootId })
        }
      },
      {
        e2eLocalRemotes: e2eProfile && process.env['GI_E2E_LOCAL_REMOTES'] === '1',
        ...(e2eClaudeReply === undefined ? {} : { e2eClaudeReply })
      }
    )
    if (demoProfile) {
      // Dossier de méthode fictif du profil démo (spec 023 T039), lié au genesis « application de notes ».
      // Tests e2e : le dépôt fictif vit HORS du profil (git refuse un dossier de données de l'app, spec 021).
      const e2eProject = e2eProfile ? process.env['GI_E2E_PROJECT'] : undefined
      const projectDir =
        e2eProject !== undefined && isAbsolute(e2eProject)
          ? e2eProject
          : writeDemoMethodFolder(join(demoData, 'projet-demo'))
      // Tests e2e « de zéro » (spec 024) : aucune donnée de démonstration.
      const empty = e2eProfile && process.env['GI_E2E_EMPTY'] === '1'
      if (!empty && seedDemo(context.database.db, DEFAULT_DEMO_SIZE, { projectDir }).seeded)
        context.logger.info('demo.seeded', {})
      // Tests e2e : coffre fictif (dossier `projects/` d'un ProjectMaster temporaire) passé par `GI_E2E_VAULT`.
      const e2eVault = e2eProfile ? process.env['GI_E2E_VAULT'] : undefined
      if (e2eVault !== undefined && isAbsolute(e2eVault)) context.appSettings.saveProjectsRoot(e2eVault)
      context.adoptLegacyCanvas()
    }
    installWidgetProtocol(session.defaultSession, context.widgets)

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
