import { z } from 'zod'
import { isValidAccelerator } from '@shared/app/accelerator'
import { MOTION_MODES, THEMES, type AppSettingsPatch, type AppSettingsView } from '@shared/ipc/app'
import { AppError } from '../domain/errors'
import { defineRoute, type IpcRoute } from './registry'

const SettingsPatch = z
  .object({
    shortcut: z.string().refine(isValidAccelerator).optional(),
    launchAtLogin: z.boolean().optional(),
    theme: z.enum(THEMES).optional(),
    motion: z.enum(MOTION_MODES).optional()
  })
  .strict()

export interface AppRoutesDeps {
  readonly version: string
  readonly settings: {
    get(): AppSettingsView
    update(patch: AppSettingsPatch & { readonly onboardingDone?: boolean }): AppSettingsView
  }
  /** Active le nouveau raccourci global ; `false` s'il est déjà pris (l'ancien reste actif). */
  readonly replaceShortcut: (accelerator: string) => boolean
  readonly applyLaunchAtLogin: (enabled: boolean) => void
}

/** Canaux de la coquille (spec 003 contracts/ipc-mvp1.md § Coquille & réglages). */
export function createAppRoutes(deps: AppRoutesDeps): IpcRoute[] {
  return [
    defineRoute({
      // Canal de santé : vérifie de bout en bout la chaîne renderer → preload → main.
      channel: 'app:ping',
      input: z.undefined(),
      handler: async () => ({ version: deps.version })
    }),
    defineRoute({
      channel: 'app:getSettings',
      input: z.undefined(),
      handler: async () => deps.settings.get()
    }),
    defineRoute({
      channel: 'app:setSettings',
      input: SettingsPatch,
      handler: async (patch) => {
        // Le raccourci est essayé avant d'être enregistré : un raccourci indisponible n'est jamais persisté.
        if (patch.shortcut !== undefined && !deps.replaceShortcut(patch.shortcut)) {
          throw new AppError('SHORTCUT_UNAVAILABLE', 'Ce raccourci est déjà utilisé par une autre application')
        }
        const next = deps.settings.update(patch as AppSettingsPatch)
        if (patch.launchAtLogin !== undefined) deps.applyLaunchAtLogin(patch.launchAtLogin)
        return next
      }
    }),
    defineRoute({
      channel: 'app:completeOnboarding',
      input: z.undefined(),
      handler: async () => {
        deps.settings.update({ onboardingDone: true })
        return { ok: true }
      }
    })
  ]
}
