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
  'neuron:removeMany',
  'skills:list',
  'skills:get',
  'skills:conversation',
  'skills:drafts',
  'skills:draftDiff',
  'skills:install',
  'skills:discardDraft',
  'skills:restore',
  'skills:remove',
  'skills:duplicate',
  'skills:import',
  'skills:library',
  'skills:librarySkill',
  'skills:libraryInstall',
  'skills:libraryRemove',
  'skills:cards',
  'skills:analyze',
  'skills:setStars',
  'skills:setDomain',
  'skills:acceptDomain',
  'skills:link',
  'skills:unlink',
  'skills:usage',
  'skills:importCancel',
  'neuron:delete',
  'canvas:get',
  'canvas:savePositions',
  'canvas:createLink',
  'plan:decide',
  'plan:move',
  'plan:setCollapsed',
  'final:decide',
  'final:demote',
  'final:execute',
  'final:stop',
  'deliverable:move',
  'deliverable:resize',
  'deliverable:get',
  'deliverable:accept',
  'deliverable:correct',
  'deliverable:revert',
  'deliverable:file',
  'deliverable:openInEditor',
  'editor:get',
  'editor:choose',
  'editor:clear',
  'project:settings',
  'project:chooseRoot',
  'project:create',
  'project:initGit',
  'document:move',
  'document:resize',
  'document:get',
  'document:remove',
  'document:recreate',
  'document:reveal',
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
  'usage:get',
  'chat:open',
  'chat:send',
  'chat:stop',
  'chat:permissionDecide',
  'chat:close',
  'chat:linkFolder',
  'chat:setModel',
  'chat:setPermissionMode',
  'reprise:previewFolder',
  'reprise:create',
  'reprise:get',
  'reprise:setConfidentiality',
  'reprise:analyze',
  'reprise:cancelAnalysis',
  'reprise:setCategory',
  'reprise:setTarget',
  'reprise:guide',
  'explorer:view',
  'explorer:node',
  'explorer:code',
  'explorer:file',
  'explorer:search',
  'explorer:locate',
  'explorer:savePosition',
  'explorer:state',
  'explorer:saveState',
  'element:setCollapsed',
  'structure:files',
  'structure:file',
  'workflow:read',
  'workflow:file',
  'workflow:setFolded',
  'structure:setArchitecture',
  'element:setLayer',
  'analyste:repo:status',
  'analyste:repo:choose',
  'analyste:events',
  'analyste:observations',
  'analyste:observations:export',
  'analyste:purge',
  'analyste:settings:get',
  'analyste:settings:set',
  'analyste:analyze',
  'analyste:cancel',
  'analyste:analyses',
  'analyste:proposals',
  'analyste:decide',
  'analyste:proposals:clear',
  'analyste:update:get',
  'analyste:update:start',
  'analyste:update:finish',
  'analyste:update:diff',
  'analyste:update:try',
  'analyste:update:keep',
  'analyste:update:discard',
  'analyste:update:revert'
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
  'final:proposed',
  'final:changed',
  'chat:delta',
  'chat:tool',
  'chat:turnEnd',
  'chat:error',
  'chat:usage',
  'chat:sheet',
  'chat:permission',
  'chat:permissionResolved',
  'reprise:analysisProgress',
  'reprise:analysisDone',
  'reprise:changed',
  'analyste:progress',
  'analyste:update:progress',
  'skills:changed',
  'skills:importProgress',
  'skills:analyzeProgress'
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
