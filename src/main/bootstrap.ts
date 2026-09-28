import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, ipcMain, safeStorage } from 'electron'
import { ContextImportService } from './application/ai/ContextImportService'
import { CaptureService } from './application/capture/CaptureService'
import { CanvasService } from './application/canvas/CanvasService'
import { HistoryService } from './application/history/HistoryService'
import { ExampleStore } from './application/ai/ExampleStore'
import { FusionService } from './application/neurons/FusionService'
import { GrowthService } from './application/neurons/GrowthService'
import { LinkService } from './application/neurons/LinkService'
import { NeuronService } from './application/neurons/NeuronService'
import { SynthesisApplier } from './application/neurons/SynthesisApplier'
import { createAiEngine, type AiEngine } from './composition/aiEngine'
import { resolveOllamaUrl } from './infrastructure/ai/OllamaProvider'
import { InboxFolder } from './infrastructure/context-inbox/InboxFolder'
import { watchInbox } from './infrastructure/context-inbox/InboxWatcher'
import { ContextRepository } from './infrastructure/db/repositories/ContextRepository'
import { FusionRepository } from './infrastructure/db/repositories/FusionRepository'
import { GrowthRepository } from './infrastructure/db/repositories/GrowthRepository'
import { LinkRepository } from './infrastructure/db/repositories/LinkRepository'
import { NeuronRepository } from './infrastructure/db/repositories/NeuronRepository'
import { AppSettingsRepository } from './infrastructure/db/repositories/AppSettingsRepository'
import { BlockRepository } from './infrastructure/db/repositories/BlockRepository'
import { HistoryRepository } from './infrastructure/db/repositories/HistoryRepository'
import { HatchedRepository } from './infrastructure/db/repositories/HatchedRepository'
import { openDatabase, type DatabaseHandle } from './infrastructure/db/client'
import { createLogger, stdoutSink, type Logger } from './infrastructure/logging/logger'
import { SecretStore } from './infrastructure/secrets/SecretStore'
import { createAiRoutes } from './ipc/aiHandlers'
import { createAppRoutes } from './ipc/appHandlers'
import { createCaptureRoutes } from './ipc/captureHandlers'
import { createCanvasRoutes } from './ipc/canvasHandlers'
import { createHistoryRoutes } from './ipc/historyHandlers'
import { createHatchedRoutes } from './ipc/hatchedHandlers'
import { createContextRoutes } from './ipc/contextHandlers'
import { createFusionRoutes } from './ipc/fusionHandlers'
import { createGrowthRoutes } from './ipc/growthHandlers'
import { createLinkRoutes } from './ipc/linkHandlers'
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
  readonly appSettings: AppSettingsRepository
  stop(): void
}

/** Ce que la coquille (fenêtres, raccourci, démarrage) offre aux services. */
export interface ShellPort {
  /** Événement de la liste blanche vers la fenêtre principale. */
  sendToMain(event: MainWindowEvent, payload: unknown): void
  replaceShortcut(accelerator: string): boolean
  applyLaunchAtLogin(enabled: boolean): void
  hideCapture(): void
  /** Ferme la capture et ouvre la fenêtre principale en plongée dans ce neurone. */
  openDive(rootId: string): void
}

/** Dossier des migrations : sources en développement, ressources de l'installeur une fois empaqueté. */
function migrationsFolder(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'migrations')
    : join(app.getAppPath(), 'src/main/infrastructure/db/migrations')
}

/** Initialise les services du processus principal. Toutes les données vivent dans %APPDATA%. */
export function bootstrap(shell: ShellPort): AppContext {
  const broadcast = (event: MainWindowEvent, payload: unknown): void => shell.sendToMain(event, payload)
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
  const neuronRepository = new NeuronRepository(database.db)
  const neurons = new NeuronService({ repository: neuronRepository, gateway: ai.gateway })
  neuronsRef.current = neurons
  const growthRepository = new GrowthRepository(database.db)
  const growth = new GrowthService({
    repository: growthRepository,
    neurons,
    gateway: ai.gateway,
    emit: (event) => broadcast(event.type, event)
  })
  const linkRepository = new LinkRepository(database.db)
  const links = new LinkService({
    repository: linkRepository,
    gateway: ai.gateway,
    examples,
    emit: (event) => broadcast(event.type, event)
  })
  const fusionRepository = new FusionRepository(database.db)
  const fusion = new FusionService({
    repository: fusionRepository,
    tree: growthRepository,
    neurons,
    gateway: ai.gateway,
    applier: new SynthesisApplier({
      repository: fusionRepository,
      tree: growthRepository,
      neurons,
      examples,
      onStale: (row) => broadcast('synthesis:stale', { rootId: row.rootId, synthesisId: row.id })
    }),
    links,
    emit: (event) => broadcast(event.type, event)
  })

  const appSettings = new AppSettingsRepository(database.db)
  const contextRoutes = createContextRoutes({ service: contextService, repository: contextRepository, inboxPath })
  // Seuls les fichiers de l'interface (out/renderer/) peuvent parler au processus principal.
  const rendererFileUrl = pathToFileURL(join(import.meta.dirname, '../renderer/')).href
  registerRoutes(
    ipcMain,
    [
      ...createAppRoutes({
        version: app.getVersion(),
        settings: appSettings,
        replaceShortcut: (accelerator) => shell.replaceShortcut(accelerator),
        applyLaunchAtLogin: (enabled) => shell.applyLaunchAtLogin(enabled)
      }),
      ...createCaptureRoutes(
        new CaptureService({ neurons, drafts: appSettings, openDive: (rootId) => shell.openDive(rootId) }),
        () => shell.hideCapture()
      ),
      ...aiRoutes,
      ...contextRoutes,
      ...createNeuronRoutes(neurons),
      ...createGrowthRoutes(growth),
      ...createFusionRoutes(fusion),
      ...createLinkRoutes(links),
      ...createCanvasRoutes(
        new CanvasService({
          neurons: neuronRepository,
          links: linkRepository,
          blocks: new BlockRepository(database.db)
        })
      ),
      ...createHistoryRoutes(new HistoryService(new HistoryRepository(database.db))),
      ...createHatchedRoutes(new HatchedRepository(database.db))
    ],
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
    appSettings,
    stop: () => {
      stopWatching()
      ai.stop()
    }
  }
}
