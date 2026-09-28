import { z } from 'zod'
import { CAPTURE_MAX_CHARS } from '@shared/ipc/app'
import type { CaptureService } from '../application/capture/CaptureService'
import { defineRoute, type IpcRoute } from './registry'

/** Canaux de la fenêtre de capture uniquement (spec 003 contracts § Capture). */
export function createCaptureRoutes(service: CaptureService, hide: () => void): IpcRoute[] {
  return [
    defineRoute({
      channel: 'capture:getDraft',
      page: 'capture',
      input: z.undefined(),
      handler: async () => service.getDraft()
    }),
    defineRoute({
      channel: 'capture:saveDraft',
      page: 'capture',
      input: z.object({ text: z.string().max(CAPTURE_MAX_CHARS) }).strict(),
      handler: async ({ text }) => {
        service.saveDraft(text)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'capture:submit',
      page: 'capture',
      input: z.object({ text: z.string().trim().min(1).max(CAPTURE_MAX_CHARS), diveNow: z.boolean() }).strict(),
      handler: (input) => service.submit(input)
    }),
    defineRoute({
      channel: 'capture:close',
      page: 'capture',
      input: z.undefined(),
      handler: async () => {
        hide()
        return { ok: true }
      }
    })
  ]
}
