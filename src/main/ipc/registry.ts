import type { IpcMain } from 'electron'
import type { z } from 'zod'
import type { IpcResult } from '@shared/ipc/result'
import { AppError } from '../domain/errors'
import type { Logger } from '../infrastructure/logging/logger'

export interface RouteDefinition<I, O> {
  readonly channel: string
  readonly input: z.ZodType<I>
  readonly handler: (input: I) => Promise<O>
}

/** Route prête à l'emploi : la validation de la charge utile est encapsulée, les types sont effacés. */
export interface IpcRoute {
  readonly channel: string
  readonly run: (payload: unknown) => Promise<unknown>
}

/** Associe un canal, son schéma d'entrée et son handler ; toute entrée invalide lève `VALIDATION`. */
export function defineRoute<I, O>({ channel, input, handler }: RouteDefinition<I, O>): IpcRoute {
  return {
    channel,
    run: async (payload) => {
      const parsed = input.safeParse(payload)
      if (!parsed.success) throw new AppError('VALIDATION', 'Données invalides')
      return handler(parsed.data)
    }
  }
}

export type Dispatcher = (channel: string, payload: unknown) => Promise<IpcResult<unknown>>

/** Exécute la route du canal et convertit toute issue au format `IpcResult`. */
export function createDispatcher(routes: readonly IpcRoute[], logger?: Logger): Dispatcher {
  const table = new Map<string, IpcRoute>()
  for (const route of routes) {
    if (table.has(route.channel)) throw new Error(`Canal IPC dupliqué : ${route.channel}`)
    table.set(route.channel, route)
  }

  return async (channel, payload) => {
    const route = table.get(channel)
    if (route === undefined) return { success: false, error: { code: 'UNKNOWN_CHANNEL', message: 'Canal inconnu' } }
    try {
      return { success: true, data: await route.run(payload) }
    } catch (error) {
      if (error instanceof AppError) return { success: false, error: { code: error.code, message: error.message } }
      // Détails internes (chemins, SQL…) jamais renvoyés ni journalisés.
      logger?.error('ipc.unexpected', { channel })
      return { success: false, error: { code: 'INTERNAL', message: 'Erreur interne' } }
    }
  }
}

/** N'accepte que les messages venant de l'interface de l'app (fichier local ou serveur de dev). */
export function isTrustedSender(frameUrl: string | undefined, devServerUrl: string | undefined): boolean {
  if (frameUrl === undefined) return false
  if (frameUrl.startsWith('file://')) return true
  return devServerUrl !== undefined && frameUrl.startsWith(devServerUrl)
}

export function registerRoutes(ipcMain: IpcMain, routes: readonly IpcRoute[], logger: Logger): void {
  const dispatch = createDispatcher(routes, logger)
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  for (const route of routes) {
    ipcMain.handle(route.channel, (event, payload: unknown) => {
      if (!isTrustedSender(event.senderFrame?.url, devServerUrl)) {
        logger.warn('ipc.untrusted_sender', { channel: route.channel })
        return { success: false, error: { code: 'FORBIDDEN', message: 'Expéditeur non autorisé' } }
      }
      return dispatch(route.channel, payload)
    })
  }
}
