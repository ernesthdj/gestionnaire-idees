import type { IpcMain } from 'electron'
import type { z } from 'zod'
import type { IpcResult } from '@shared/ipc/result'
import { AppError } from '../domain/errors'
import type { Logger } from '../infrastructure/logging/logger'

export interface RouteDefinition<I, O> {
  readonly channel: string
  /** Page autorisée à appeler ce canal (fenêtre principale par défaut). */
  readonly page?: SenderPage
  readonly input: z.ZodType<I>
  readonly handler: (input: I) => Promise<O>
}

/** Route prête à l'emploi : la validation de la charge utile est encapsulée, les types sont effacés. */
export interface IpcRoute {
  readonly channel: string
  readonly page: SenderPage
  readonly run: (payload: unknown) => Promise<unknown>
}

/** Associe un canal, son schéma d'entrée et son handler ; toute entrée invalide lève `VALIDATION`. */
export function defineRoute<I, O>({ channel, page = 'main', input, handler }: RouteDefinition<I, O>): IpcRoute {
  return {
    channel,
    page,
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
      if (error instanceof AppError) {
        const { code, message, details } = error
        return { success: false, error: { code, message, ...(details === undefined ? {} : { details }) } }
      }
      // Détails internes (chemins, SQL…) jamais renvoyés ni journalisés.
      logger?.error('ipc.unexpected', { channel })
      return { success: false, error: { code: 'INTERNAL', message: 'Erreur interne' } }
    }
  }
}

/** Page de l'interface qui émet un message : chacune n'a accès qu'à ses propres canaux (moindre privilège). */
export type SenderPage = 'main' | 'capture'

const PAGES: Readonly<Record<string, SenderPage>> = { '': 'main', 'index.html': 'main', 'capture.html': 'capture' }

/**
 * Identifie la page émettrice : uniquement les fichiers de l'interface de l'app (dossier `renderer`) une fois
 * empaquetée, ou le serveur de développement. Tout autre expéditeur renvoie `null`.
 */
export function senderPage(
  frameUrl: string | undefined,
  devServerUrl: string | undefined,
  rendererFileUrl: string
): SenderPage | null {
  if (frameUrl === undefined || !URL.canParse(frameUrl)) return null
  const url = new URL(frameUrl)
  let path: string
  if (url.protocol === 'file:') {
    const base = new URL(rendererFileUrl).pathname
    if (!url.pathname.startsWith(base)) return null
    path = url.pathname.slice(base.length)
  } else {
    if (devServerUrl === undefined || !URL.canParse(devServerUrl) || url.origin !== new URL(devServerUrl).origin)
      return null
    path = url.pathname.slice(1)
  }
  return PAGES[path] ?? null
}

export function registerRoutes(
  ipcMain: IpcMain,
  routes: readonly IpcRoute[],
  logger: Logger,
  rendererFileUrl: string
): void {
  const dispatch = createDispatcher(routes, logger)
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  for (const route of routes) {
    ipcMain.handle(route.channel, (event, payload: unknown) => {
      if (senderPage(event.senderFrame?.url, devServerUrl, rendererFileUrl) !== route.page) {
        logger.warn('ipc.untrusted_sender', { channel: route.channel })
        return { success: false, error: { code: 'FORBIDDEN', message: 'Expéditeur non autorisé' } }
      }
      return dispatch(route.channel, payload)
    })
  }
}
