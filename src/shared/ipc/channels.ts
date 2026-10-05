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
  'ai:getConfig',
  'ai:setConfig',
  'ai:test',
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
  'canvas:get',
  'canvas:savePositions',
  'canvas:createLink',
  'plan:decide',
  'canvas:createBlock',
  'canvas:updateBlock',
  'canvas:deleteBlock',
  'history:list',
  'history:undo',
  'widgetIo:state',
  'widgetIo:connect',
  'widgetIo:setParts',
  'widgetIo:disconnect',
  'widgetIo:approve',
  'widgetIo:inputs',
  'widgetIo:emit',
  'widgetIo:result',
  'widget:get',
  'widget:prompt',
  'widget:restore',
  'map:selection',
  'mcp:status',
  'mcp:rotateToken',
  'chat:open',
  'chat:send',
  'chat:stop',
  'chat:close',
  'chat:linkFolder',
  'chat:setModel',
  'element:setCollapsed'
] as const

export type MainWindowChannel = (typeof MAIN_WINDOW_CHANNELS)[number]

/** Événements poussés du processus principal vers la fenêtre principale. */
export const MAIN_WINDOW_EVENTS = [
  'app:navigate',
  'app:settingsChanged',
  'shortcut:unavailable',
  'context:newImport',
  'widget:thinking',
  'widget:thought',
  'map:changed',
  'plan:proposed',
  'chat:delta',
  'chat:tool',
  'chat:turnEnd',
  'chat:error',
  'chat:usage',
  'chat:sheet'
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
