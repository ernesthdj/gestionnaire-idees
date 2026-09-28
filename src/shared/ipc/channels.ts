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
  'ai:unlockBudget',
  'context:list',
  'context:pending',
  'context:apply',
  'context:reject',
  'context:rollback',
  'neuron:create',
  'neuron:list',
  'neuron:getTree',
  'neuron:update',
  'neuron:archive',
  'neuron:delete',
  'growth:develop',
  'growth:answer',
  'growth:more',
  'growth:dismiss',
  'growth:addBranch',
  'growth:acceptSuggestion',
  'growth:dismissSuggestion',
  'fusion:lock',
  'fusion:revise',
  'fusion:confirm',
  'fusion:reject',
  'fusion:reopen'
] as const

export type MainWindowChannel = (typeof MAIN_WINDOW_CHANNELS)[number]

/** Événements poussés du processus principal vers la fenêtre principale. */
export const MAIN_WINDOW_EVENTS = [
  'ai:budgetAlert',
  'context:newImport',
  'neuron:created',
  'neuron:thinking',
  'neuron:thought',
  'synthesis:stale',
  'suggestion:updated'
] as const

export type MainWindowEvent = (typeof MAIN_WINDOW_EVENTS)[number]

export function isMainWindowChannel(channel: string): channel is MainWindowChannel {
  return (MAIN_WINDOW_CHANNELS as readonly string[]).includes(channel)
}

export function isMainWindowEvent(event: string): event is MainWindowEvent {
  return (MAIN_WINDOW_EVENTS as readonly string[]).includes(event)
}
