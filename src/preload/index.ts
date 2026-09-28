import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '@shared/app-api'
import { isMainWindowChannel } from '@shared/ipc/channels'
import type { IpcResult } from '@shared/ipc/result'

const api: AppApi = {
  platform: process.platform,
  invoke<T>(channel: string, payload?: unknown): Promise<IpcResult<T>> {
    // Défense en profondeur : le main valide aussi le canal et l'expéditeur.
    if (!isMainWindowChannel(channel)) {
      return Promise.resolve({ success: false, error: { code: 'UNKNOWN_CHANNEL', message: 'Canal non autorisé' } })
    }
    return ipcRenderer.invoke(channel, payload) as Promise<IpcResult<T>>
  }
}

contextBridge.exposeInMainWorld('api', api)
