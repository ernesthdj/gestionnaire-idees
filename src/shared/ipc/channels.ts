/**
 * Liste blanche des canaux IPC invocables depuis la fenêtre principale.
 * Sans dépendance : le preload (sandbox) l'importe directement.
 * Chaque feature ajoute ses canaux ici au moment où elle enregistre les handlers correspondants.
 */
export const MAIN_WINDOW_CHANNELS = ['app:ping'] as const

export type MainWindowChannel = (typeof MAIN_WINDOW_CHANNELS)[number]

export function isMainWindowChannel(channel: string): channel is MainWindowChannel {
  return (MAIN_WINDOW_CHANNELS as readonly string[]).includes(channel)
}
