import type { CaptureWindowChannel, CaptureWindowEvent, MainWindowChannel, MainWindowEvent } from './ipc/channels'
import type { IpcResult } from './ipc/result'

/** Contrat de l'API exposée par le preload au renderer (`window.api`). */
export interface AppApi {
  readonly platform: string
  /** Invoque un canal de la liste blanche ; la charge utile est validée côté processus principal. */
  invoke<T>(channel: MainWindowChannel, payload?: unknown): Promise<IpcResult<T>>
  /** S'abonne à un événement de la liste blanche ; renvoie la fonction de désabonnement. */
  on(event: MainWindowEvent, listener: (payload: unknown) => void): () => void
}

/** API de la fenêtre de capture (`window.captureApi`) : uniquement les canaux `capture:*`. */
export interface CaptureApi {
  invoke<T>(channel: CaptureWindowChannel, payload?: unknown): Promise<IpcResult<T>>
  on(event: CaptureWindowEvent, listener: (payload: unknown) => void): () => void
}
