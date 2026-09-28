/** Argument ajouté au lancement automatique avec Windows : l'app démarre dans la zone de notification. */
export const HIDDEN_FLAG = '--hidden'

export function startsHidden(argv: readonly string[]): boolean {
  return argv.includes(HIDDEN_FLAG)
}

export interface LoginItemSettings {
  readonly openAtLogin: boolean
  readonly args: string[]
}

export function loginItemSettings(enabled: boolean): LoginItemSettings {
  return { openAtLogin: enabled, args: [HIDDEN_FLAG] }
}
