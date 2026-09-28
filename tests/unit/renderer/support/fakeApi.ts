import { vi } from 'vitest'
import type { AppApi } from '../../../../src/shared/app-api'
import type { MainWindowChannel, MainWindowEvent } from '../../../../src/shared/ipc/channels'
import type { IpcResult } from '../../../../src/shared/ipc/result'

type Handler = (payload: unknown) => unknown

/** À lever dans un gestionnaire simulé pour que le canal réponde par un échec `{ code, message }`. */
export class FakeIpcError extends Error {
  constructor(
    readonly code: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(code)
  }
}

/** Double de `window.api` : réponses par canal, et émission d'événements du main vers l'interface. */
export function installFakeApi(handlers: Partial<Record<MainWindowChannel, Handler>> = {}) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const invoke = vi.fn(async (channel: MainWindowChannel, payload?: unknown): Promise<IpcResult<unknown>> => {
    const handler = handlers[channel]
    if (handler === undefined)
      return { success: false, error: { code: 'UNKNOWN_CHANNEL', message: 'Canal non simulé' } }
    try {
      return { success: true, data: await handler(payload) }
    } catch (error) {
      if (error instanceof FakeIpcError) {
        const details = error.details === undefined ? {} : { details: error.details }
        return { success: false, error: { code: error.code, message: error.message, ...details } }
      }
      throw error
    }
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
