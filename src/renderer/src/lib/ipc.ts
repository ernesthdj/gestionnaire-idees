import type { MainWindowChannel } from '@shared/ipc/channels'
import type { IpcError } from '@shared/ipc/result'

/** Échec IPC levé comme une erreur, pour TanStack Query (états `error`, nouvelle tentative, etc.). */
export class IpcFailure extends Error {
  readonly code: string
  readonly details: IpcError['details']

  constructor(error: IpcError) {
    super(error.message)
    this.name = 'IpcFailure'
    this.code = error.code
    this.details = error.details
  }
}

/** Appelle un canal de la fenêtre principale et renvoie ses données, ou lève `IpcFailure`. */
export async function call<T>(channel: MainWindowChannel, payload?: unknown): Promise<T> {
  const result = await window.api.invoke<T>(channel, payload)
  if (!result.success) throw new IpcFailure(result.error)
  return result.data
}
