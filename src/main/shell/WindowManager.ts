import { BrowserWindow, screen } from 'electron'
import type { NavigateEvent } from '@shared/ipc/app'
import type { CaptureWindowEvent, MainWindowEvent } from '@shared/ipc/channels'
import { guardNavigation, hardenedWebPreferences, loadPage } from './hardening'
import { captureBounds, CAPTURE_SIZE } from './placement'

/**
 * Deux fenêtres (research R1) : la principale, créée à la demande et seulement cachée à la fermeture (l'app vit
 * dans la zone de notification) ; la capture, pré-chargée et cachée pour s'afficher sans délai.
 */
export class WindowManager {
  private main: BrowserWindow | undefined
  private capture: BrowserWindow | undefined
  private quitting = false

  /** À appeler avant de quitter : les fenêtres se ferment alors vraiment au lieu de se cacher. */
  setQuitting(): void {
    this.quitting = true
  }

  showMain(navigate?: NavigateEvent): void {
    const window = this.main ?? this.createMain()
    if (window.isMinimized()) window.restore()
    if (window.webContents.isLoading()) {
      window.once('ready-to-show', () => window.show())
      if (navigate !== undefined)
        window.webContents.once('did-finish-load', () => this.sendToMain('app:navigate', navigate))
      return
    }
    window.show()
    window.focus()
    if (navigate !== undefined) this.sendToMain('app:navigate', navigate)
  }

  /** Événement de la liste blanche vers la fenêtre principale, si elle existe. */
  sendToMain(event: MainWindowEvent, payload: unknown): void {
    this.main?.webContents.send(event, payload)
  }

  /** Crée la fenêtre de capture cachée (au démarrage) : son premier affichage est alors instantané. */
  preloadCapture(): void {
    if (this.capture !== undefined) return
    const window = new BrowserWindow({
      ...CAPTURE_SIZE,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: hardenedWebPreferences('capture')
    })
    window.setAlwaysOnTop(true, 'screen-saver')
    guardNavigation(window)
    // Clic extérieur = fermeture ; le brouillon est enregistré au fil de la frappe par l'interface.
    window.on('blur', () => this.hideCapture())
    window.on('close', (event) => {
      if (this.quitting) return
      event.preventDefault()
      this.hideCapture()
    })
    window.on('closed', () => (this.capture = undefined))
    loadPage(window, 'capture')
    this.capture = window
  }

  /** Affiche la capture sur l'écran où se trouve le curseur, au premier plan, prête à la saisie. */
  showCapture(payload: unknown): void {
    this.preloadCapture()
    const window = this.capture
    if (window === undefined) return
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    window.setBounds(captureBounds(display.workArea))
    window.show()
    window.focus()
    this.sendToCapture('capture:shown', payload)
  }

  /** `blur()` puis `hide()` : Windows rend alors le focus à l'application utilisée avant la capture. */
  hideCapture(): void {
    const window = this.capture
    if (window === undefined || !window.isVisible()) return
    window.blur()
    window.hide()
  }

  private sendToCapture(event: CaptureWindowEvent, payload: unknown): void {
    this.capture?.webContents.send(event, payload)
  }

  private createMain(): BrowserWindow {
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 768,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      webPreferences: hardenedWebPreferences('main')
    })
    guardNavigation(window)
    window.on('close', (event) => {
      if (this.quitting) return
      event.preventDefault()
      window.hide()
    })
    window.on('closed', () => (this.main = undefined))
    loadPage(window, 'index')
    this.main = window
    return window
  }
}
