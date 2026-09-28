import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppApi, CaptureApi } from '@shared/app-api'
import {
  isCaptureWindowChannel,
  isCaptureWindowEvent,
  isMainWindowChannel,
  isMainWindowEvent,
  WINDOW_ARG_PREFIX
} from '@shared/ipc/channels'
import type { IpcResult } from '@shared/ipc/result'

/**
 * Un seul preload (un preload en sandbox ne peut charger aucun autre fichier) : chaque fenêtre n'expose que
 * l'API de ses propres canaux, selon l'argument `--gi-window=` fixé par le main à sa création.
 */
function createBridge<Channel extends string, Event extends string>(
  isChannelAllowed: (channel: string) => channel is Channel,
  isEventAllowed: (event: string) => event is Event
): {
  invoke<T>(channel: Channel, payload?: unknown): Promise<IpcResult<T>>
  on(event: Event, listener: (payload: unknown) => void): () => void
} {
  return {
    invoke<T>(channel: string, payload?: unknown): Promise<IpcResult<T>> {
      // Défense en profondeur : le main valide aussi le canal et la page émettrice.
      if (!isChannelAllowed(channel)) {
        return Promise.resolve({ success: false, error: { code: 'UNKNOWN_CHANNEL', message: 'Canal non autorisé' } })
      }
      return ipcRenderer.invoke(channel, payload) as Promise<IpcResult<T>>
    },
    on(event: string, listener: (payload: unknown) => void): () => void {
      if (!isEventAllowed(event)) return () => undefined
      // L'objet événement d'Electron n'est jamais transmis au renderer (il exposerait `sender`).
      const wrapped = (_event: IpcRendererEvent, payload: unknown): void => listener(payload)
      ipcRenderer.on(event, wrapped)
      return () => ipcRenderer.removeListener(event, wrapped)
    }
  }
}

if (process.argv.includes(`${WINDOW_ARG_PREFIX}capture`)) {
  const captureApi: CaptureApi = createBridge(isCaptureWindowChannel, isCaptureWindowEvent)
  contextBridge.exposeInMainWorld('captureApi', captureApi)
} else {
  const api: AppApi = { platform: process.platform, ...createBridge(isMainWindowChannel, isMainWindowEvent) }
  contextBridge.exposeInMainWorld('api', api)
}
