import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { ContextImportService } from './application/ai/ContextImportService'
import { ExampleStore } from './application/ai/ExampleStore'
import { GrowthService } from './application/neurons/GrowthService'
import { NeuronService } from './application/neurons/NeuronService'
import { createAiEngine, type AiEngine } from './composition/aiEngine'
import { resolveOllamaUrl } from './infrastructure/ai/OllamaProvider'
import { InboxFolder } from './infrastructure/context-inbox/InboxFolder'
import { watchInbox } from './infrastructure/context-inbox/InboxWatcher'
import { ContextRepository } from './infrastructure/db/repositories/ContextRepository'
import { GrowthRepository } from './infrastructure/db/repositories/GrowthRepository'
import { NeuronRepository } from './infrastructure/db/repositories/NeuronRepository'
import { openDatabase, type DatabaseHandle } from './infrastructure/db/client'
import { createLogger, stdoutSink, type Logger } from './infrastructure/logging/logger'
import { SecretStore } from './infrastructure/secrets/SecretStore'
import { createAiRoutes } from './ipc/aiHandlers'
import { appRoutes } from './ipc/appHandlers'
import { createContextRoutes } from './ipc/contextHandlers'
import { createGrowthRoutes } from './ipc/growthHandlers'
import { createNeuronRoutes } from './ipc/neuronHandlers'
import { registerRoutes } from './ipc/registry'
import type { MainWindowEvent } from '@shared/ipc/channels'

export interface AppContext {
  readonly logger: Logger
  readonly secrets: SecretStore
  readonly database: DatabaseHandle
  readonly ai: AiEngine
  readonly examples: ExampleStore
  readonly neurons: NeuronService
  stop(): void
}

/** Envoie un événement de la liste blanche à toutes les fenêtres ouvertes. */
function broadcast(event: MainWindowEvent, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(event, payload)
}

/** Dossier des migrations : sources en développement, ressources de l'installeur une fois empaqueté. */
function migrationsFolder(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'migrations')
    : join(app.getAppPath(), 'src/main/infrastructure/db/migrations')
}

/** Initialise les services du processus principal. Toutes les données vivent dans %APPDATA%. */
export function bootstrap(): AppContext {
  const logger = createLogger(stdoutSink)
  const dataDir = app.getPath('userData')
  const secrets = new SecretStore(join(dataDir, 'secrets'), safeStorage)

  const database = openDatabase({
    file: join(dataDir, 'gestionnaire-idees.db'),
    key: secrets.getOrCreateRandomKey('db'),
    migrationsFolder: migrationsFolder()
  })

  // Import de contexte (US5) : Claude Code dépose profil, règles et exemples dans ce dossier.
  const contextRepository = new ContextRepository(database.db)
  const examples = new ExampleStore(contextRepository)
  const inboxPath = join(dataDir, 'context-inbox')
  const contextService = new ContextImportService({
    repository: contextRepository,
    inbox: new InboxFolder(inboxPath, join(dataDir, 'context-archive')),
    examples,
    now: () => new Date(),
    onNewImport: (importId) => broadcast('context:newImport', { importId })
  })
  contextService.ensureSeed()
  const scanInbox = (): void => {
    try {
      contextService.scan()
    } catch {
      logger.error('context.scan_failed', {})
    }
  }
  const stopWatching = watchInbox(inboxPath, scanInbox)
  scanInbox()

  // Le service des neurones dépend de la passerelle IA, créée juste après : référence résolue ensuite.
  const neuronsRef: { current?: NeuronService } = {}
  const ollama = resolveOllamaUrl(process.env['OLLAMA_URL'])
  if (ollama.rejected) logger.warn('ai.ollama_url_rejected', {})

  const ai = createAiEngine({
    db: database.db,
    secrets,
    logger,
    ollamaUrl: ollama.url,
    contextSource: (kind) => contextService.activeContext(kind),
    onBudgetAlert: (spentCents, capCents) => broadcast('ai:budgetAlert', { spentCents, capCents }),
    // Rejeu de la file locale (ex. catégorisation d'une idée capturée pendant qu'Ollama était arrêté).
    onQueuedCompleted: (requestId, data) => neuronsRef.current?.applyQueuedResult(requestId, data)
  })

  const aiRoutes = createAiRoutes({
    config: ai.config,
    secrets,
    ollamaStatus: () => ai.ollama.isAvailable(),
    claudePing: () => ai.claude.ping(),
    spentMillicentsThisMonth: () => ai.spentMillicentsThisMonth(),
    now: () => new Date()
  })
  const neurons = new NeuronService({ repository: new NeuronRepository(database.db), gateway: ai.gateway })
  neuronsRef.current = neurons
  const growth = new GrowthService({
    repository: new GrowthRepository(database.db),
    neurons,
    gateway: ai.gateway,
    emit: (event) => broadcast(event.type, event)
  })

  const contextRoutes = createContextRoutes({ service: contextService, repository: contextRepository, inboxPath })
  // Seuls les fichiers de l'interface (out/renderer/) peuvent parler au processus principal.
  const rendererFileUrl = pathToFileURL(join(import.meta.dirname, '../renderer/')).href
  registerRoutes(
    ipcMain,
    [...appRoutes, ...aiRoutes, ...contextRoutes, ...createNeuronRoutes(neurons), ...createGrowthRoutes(growth)],
    logger,
    rendererFileUrl
  )
  logger.info('app.ready', { version: app.getVersion() })
  return {
    logger,
    secrets,
    database,
    ai,
    examples,
    neurons,
    stop: () => {
      stopWatching()
      ai.stop()
    }
  }
}
