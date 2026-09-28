/** Vues et constantes de la coquille de l'app (spec 003 contracts/ipc-mvp1.md). */

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

/** `auto` suit la préférence système « réduire les animations » ; `reduced` les réduit toujours. */
export const MOTION_MODES = ['auto', 'reduced'] as const
export type MotionMode = (typeof MOTION_MODES)[number]

export const SECTIONS = ['ideas', 'pending', 'history'] as const
export type Section = (typeof SECTIONS)[number]

export const CAPTURE_MAX_CHARS = 2000

export interface AppSettingsView {
  readonly shortcut: string
  readonly launchAtLogin: boolean
  readonly theme: Theme
  readonly motion: MotionMode
  readonly onboardingDone: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettingsView = {
  shortcut: 'Control+Alt+Space',
  launchAtLogin: true,
  theme: 'system',
  motion: 'auto',
  onboardingDone: false
}

export type AppSettingsPatch = Partial<Pick<AppSettingsView, 'shortcut' | 'launchAtLogin' | 'theme' | 'motion'>>

/** Demande de navigation poussée par le main (zone de notification, capture « plonger maintenant »). */
export interface NavigateEvent {
  readonly section: Section
  readonly diveRootId?: string
}
