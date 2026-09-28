import { Menu, nativeImage, Tray } from 'electron'
import { drawNeuronIcon } from './trayIcon'

export interface TrayActions {
  readonly capture: () => void
  readonly open: () => void
  readonly openPending: () => void
  readonly quit: () => void
}

const ICON_COLOR = { r: 0x25, g: 0x63, b: 0xeb }

/** Icône de la zone de notification (FR-001) : Capturer, Ouvrir, À valider (n), Quitter. */
export class TrayController {
  private readonly tray: Tray
  private pending = 0

  constructor(private readonly actions: TrayActions) {
    // Deux résolutions (16 px à 100 %, 32 px à 200 %) : Windows choisit celle de l'écran, sans redimensionner.
    const icon = nativeImage.createEmpty()
    for (const scaleFactor of [1, 2]) {
      const size = 16 * scaleFactor
      icon.addRepresentation({ scaleFactor, width: size, height: size, buffer: drawNeuronIcon(size, ICON_COLOR) })
    }
    this.tray = new Tray(icon)
    this.tray.setToolTip("Gestionnaire d'idées")
    this.tray.on('click', () => actions.open())
    this.render()
  }

  setPendingCount(count: number): void {
    this.pending = count
    this.render()
  }

  destroy(): void {
    this.tray.destroy()
  }

  private render(): void {
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Capturer une idée', click: () => this.actions.capture() },
        { label: 'Ouvrir', click: () => this.actions.open() },
        { label: `À valider (${this.pending})`, click: () => this.actions.openPending() },
        { type: 'separator' },
        { label: 'Quitter', click: () => this.actions.quit() }
      ])
    )
  }
}
