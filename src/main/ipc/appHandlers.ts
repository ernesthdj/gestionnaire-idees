import { app } from 'electron'
import { z } from 'zod'
import { defineRoute } from './registry'

/** Canal de santé : vérifie de bout en bout la chaîne renderer → preload → main. */
export const appRoutes = [
  defineRoute({
    channel: 'app:ping',
    input: z.undefined(),
    handler: async () => ({ version: app.getVersion() })
  })
]
