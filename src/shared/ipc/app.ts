/** Vues et constantes de la coquille de l'app (spec 003 contracts/ipc-mvp1.md). */

import type { DefaultPermissionMode } from './chat'

export const THEMES = ['system', 'light', 'dark', 'carbon'] as const
export type Theme = (typeof THEMES)[number]

/** Schéma de couleurs d'un thème (React Flow, widgets) : Carbone est un thème sombre (spec 022 D21). */
export function colorSchemeOf(theme: Theme): 'system' | 'light' | 'dark' {
  return theme === 'carbon' ? 'dark' : theme
}

/** `auto` suit la préférence système « réduire les animations » ; `reduced` les réduit toujours. */
export const MOTION_MODES = ['auto', 'reduced'] as const
export type MotionMode = (typeof MOTION_MODES)[number]

/** `home` : le Project Manager (spec 024), premier écran de l'app. */
export const SECTIONS = ['home', 'ideas', 'pending', 'history', 'skills', 'analyste'] as const
export type Section = (typeof SECTIONS)[number]

export const CAPTURE_MAX_CHARS = 2000

/**
 * Largeur du panneau de droite de l'écran Idées (spec 027 D6), en pourcentage de l'écran : 38 par défaut (règle φ),
 * réglable de 25 à 55 par pas de 2 au clavier.
 */
export const CHAT_PANEL_WIDTH = { min: 25, max: 55, default: 38, step: 2 } as const

export interface AppSettingsView {
  readonly shortcut: string
  readonly launchAtLogin: boolean
  readonly theme: Theme
  readonly motion: MotionMode
  readonly onboardingDone: boolean
  /** Mode de permission des nouvelles conversations (spec 014 D8). */
  readonly chatPermissionMode: DefaultPermissionMode
  /** Largeur du panneau de droite de l'écran Idées, en % (spec 027 D6). */
  readonly chatPanelWidth: number
}

export const DEFAULT_APP_SETTINGS: AppSettingsView = {
  shortcut: 'Control+Alt+Space',
  launchAtLogin: true,
  theme: 'system',
  motion: 'auto',
  onboardingDone: false,
  chatPermissionMode: 'default',
  chatPanelWidth: CHAT_PANEL_WIDTH.default
}

export type AppSettingsPatch = Partial<
  Pick<AppSettingsView, 'shortcut' | 'launchAtLogin' | 'theme' | 'motion' | 'chatPermissionMode' | 'chatPanelWidth'>
>

/** Demande de navigation poussée par le main (zone de notification, capture « plonger maintenant »). */
export interface NavigateEvent {
  readonly section: Section
  readonly diveRootId?: string
}
