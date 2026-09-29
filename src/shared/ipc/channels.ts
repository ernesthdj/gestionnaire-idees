/**
 * Listes blanches des canaux IPC de la fenêtre principale.
 * Sans dépendance : le preload (sandbox) les importe directement.
 * Chaque feature ajoute ses canaux ici au moment où elle enregistre les handlers correspondants.
 */
export const MAIN_WINDOW_CHANNELS = [
  'app:ping',
  'app:getSettings',
  'app:setSettings',
  'app:completeOnboarding',
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
  'neuron:remove',
  'neuron:delete',
  'growth:develop',
  'growth:answer',
  'growth:more',
  'growth:dismiss',
  'growth:addBranch',
  'growth:editBranch',
  'growth:acceptSuggestion',
  'growth:dismissSuggestion',
  'fusion:lock',
  'fusion:getProposed',
  'fusion:editProposed',
  'fusion:revise',
  'fusion:confirm',
  'fusion:reject',
  'fusion:reopen',
  'links:list',
  'links:decide',
  'links:create',
  'links:update',
  'links:delete',
  'seeds:list',
  'seeds:accept',
  'seeds:reject',
  'canvas:get',
  'canvas:savePositions',
  'canvas:createBlock',
  'canvas:updateBlock',
  'canvas:deleteBlock',
  'history:list',
  'history:undo',
  'hatched:get'
] as const

export type MainWindowChannel = (typeof MAIN_WINDOW_CHANNELS)[number]

/** Événements poussés du processus principal vers la fenêtre principale. */
export const MAIN_WINDOW_EVENTS = [
  'app:navigate',
  'app:settingsChanged',
  'shortcut:unavailable',
  'ai:budgetAlert',
  'context:newImport',
  'neuron:created',
  'neuron:thinking',
  'neuron:thought',
  'synthesis:stale',
  'suggestion:updated',
  'links:suggested',
  'seeds:suggested'
] as const

export type MainWindowEvent = (typeof MAIN_WINDOW_EVENTS)[number]

export function isMainWindowChannel(channel: string): channel is MainWindowChannel {
  return (MAIN_WINDOW_CHANNELS as readonly string[]).includes(channel)
}

export function isMainWindowEvent(event: string): event is MainWindowEvent {
  return (MAIN_WINDOW_EVENTS as readonly string[]).includes(event)
}

/** Argument passé au preload pour désigner sa fenêtre (`--gi-window=main` ou `--gi-window=capture`). */
export const WINDOW_ARG_PREFIX = '--gi-window='

/** Canaux de la fenêtre de capture : son preload n'expose rien d'autre (moindre privilège). */
export const CAPTURE_WINDOW_CHANNELS = [
  'capture:getDraft',
  'capture:saveDraft',
  'capture:submit',
  'capture:close'
] as const

export type CaptureWindowChannel = (typeof CAPTURE_WINDOW_CHANNELS)[number]

/** `capture:shown` : la fenêtre (pré-chargée, cachée) vient d'être affichée ; l'interface se remet à zéro. */
export const CAPTURE_WINDOW_EVENTS = ['capture:shown'] as const

export type CaptureWindowEvent = (typeof CAPTURE_WINDOW_EVENTS)[number]

export function isCaptureWindowChannel(channel: string): channel is CaptureWindowChannel {
  return (CAPTURE_WINDOW_CHANNELS as readonly string[]).includes(channel)
}

export function isCaptureWindowEvent(event: string): event is CaptureWindowEvent {
  return (CAPTURE_WINDOW_EVENTS as readonly string[]).includes(event)
}
