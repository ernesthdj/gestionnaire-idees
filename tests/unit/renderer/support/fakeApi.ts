import { vi } from 'vitest'
import type { AppApi } from '../../../../src/shared/app-api'
import type { MainWindowChannel, MainWindowEvent } from '../../../../src/shared/ipc/channels'
import type { IpcResult } from '../../../../src/shared/ipc/result'

type Handler = (payload: unknown) => unknown

/** Double de `window.api` : réponses par canal, et émission d'événements du main vers l'interface. */
export function installFakeApi(handlers: Partial<Record<MainWindowChannel, Handler>> = {}) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const invoke = vi.fn(async (channel: MainWindowChannel, payload?: unknown): Promise<IpcResult<unknown>> => {
    const handler = handlers[channel]
    if (handler === undefined)
      return { success: false, error: { code: 'UNKNOWN_CHANNEL', message: 'Canal non simulé' } }
    return { success: true, data: handler(payload) }
  })
  const api = {
    platform: 'win32',
    invoke,
    on: (event: MainWindowEvent, listener: (payload: unknown) => void) => {
      const set = listeners.get(event) ?? new Set()
      set.add(listener)
      listeners.set(event, set)
      return () => set.delete(listener)
    }
  } as AppApi
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  return {
    invoke,
    emit: (event: MainWindowEvent, payload: unknown): void =>
      listeners.get(event)?.forEach((listener) => listener(payload))
  }
}
