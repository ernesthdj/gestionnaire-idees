/**
 * Listes blanches des canaux IPC de la fenêtre principale.
 * Sans dépendance : le preload (sandbox) les importe directement.
 * Chaque feature ajoute ses canaux ici au moment où elle enregistre les handlers correspondants.
 */
export const MAIN_WINDOW_CHANNELS = [
  'app:ping',
  'ai:status',
  'ai:setClaudeKey',
  'ai:clearClaudeKey',
  'ai:getConfig',
  'ai:setConfig',
  'ai:test',
  'ai:unlockBudget'
] as const

export type MainWindowChannel = (typeof MAIN_WINDOW_CHANNELS)[number]

/** Événements poussés du processus principal vers la fenêtre principale. */
export const MAIN_WINDOW_EVENTS = ['ai:budgetAlert'] as const

export type MainWindowEvent = (typeof MAIN_WINDOW_EVENTS)[number]

export function isMainWindowChannel(channel: string): channel is MainWindowChannel {
  return (MAIN_WINDOW_CHANNELS as readonly string[]).includes(channel)
}

export function isMainWindowEvent(event: string): event is MainWindowEvent {
  return (MAIN_WINDOW_EVENTS as readonly string[]).includes(event)
}
