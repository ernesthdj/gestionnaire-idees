import type { MainWindowChannel } from './ipc/channels'
import type { IpcResult } from './ipc/result'

/** Contrat de l'API exposée par le preload au renderer (`window.api`). */
export interface AppApi {
  readonly platform: string
  /** Invoque un canal de la liste blanche ; la charge utile est validée côté processus principal. */
  invoke<T>(channel: MainWindowChannel, payload?: unknown): Promise<IpcResult<T>>
}
