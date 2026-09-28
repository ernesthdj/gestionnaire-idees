import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppApi } from '@shared/app-api'
import { isMainWindowChannel, isMainWindowEvent } from '@shared/ipc/channels'
import type { IpcResult } from '@shared/ipc/result'

const api: AppApi = {
  platform: process.platform,
  invoke<T>(channel: string, payload?: unknown): Promise<IpcResult<T>> {
    // Défense en profondeur : le main valide aussi le canal et l'expéditeur.
    if (!isMainWindowChannel(channel)) {
      return Promise.resolve({ success: false, error: { code: 'UNKNOWN_CHANNEL', message: 'Canal non autorisé' } })
    }
    return ipcRenderer.invoke(channel, payload) as Promise<IpcResult<T>>
  },
  on(event: string, listener: (payload: unknown) => void): () => void {
    if (!isMainWindowEvent(event)) return () => undefined
    // L'objet événement d'Electron n'est jamais transmis au renderer (il exposerait `sender`).
    const wrapped = (_event: IpcRendererEvent, payload: unknown): void => listener(payload)
    ipcRenderer.on(event, wrapped)
    return () => ipcRenderer.removeListener(event, wrapped)
  }
}

contextBridge.exposeInMainWorld('api', api)
