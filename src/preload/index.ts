import { contextBridge } from 'electron'
import type { AppApi } from '@shared/app-api'

// API minimale exposée au renderer. Les canaux IPC typés et validés s'ajoutent ici (T011, T012).
const api: AppApi = {
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)
