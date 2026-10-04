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
import { SeedService } from './application/neurons/SeedService'
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
import { createSummaryRoutes } from './ipc/summaryHandlers'
import { IdeaSummaryService } from './application/neurons/IdeaSummaryService'
import { createLinkRoutes } from './ipc/linkHandlers'
import { createSeedRoutes } from './ipc/seedHandlers'
import { createNeuronRoutes } from './ipc/neuronHandlers'
import { registerRoutes } from './ipc/registry'
import { createWidgetRoutes } from './ipc/widgetHandlers'
import { createWidgetIoRoutes } from './ipc/widgetIoHandlers'
import { WidgetIoService } from './application/widgets/WidgetIoService'
import { WidgetIoRepository } from './infrastructure/db/repositories/WidgetIoRepository'
import { WidgetService } from './application/widgets/WidgetService'
import { WidgetRepository } from './infrastructure/db/repositories/WidgetRepository'
import type { WidgetRequestView } from '@shared/ipc/widgets'
import { WidgetRequestRepository } from './infrastructure/db/repositories/WidgetRequestRepository'
import { ToolGeneration } from './application/widgets/ToolGeneration'
import { toolSurroundings } from './application/widgets/toolSurroundings'
import type { MainWindowEvent } from '@shared/ipc/channels'
import { MapService } from './application/mcp/MapService'
import { SelectionStore } from './application/mcp/SelectionStore'
import { MapLinkRepository } from './infrastructure/db/repositories/MapLinkRepository'
import { pipeNameFor, tokenPathFor } from './infrastructure/mcp/endpoint'
import { PipeServer } from './infrastructure/mcp/PipeServer'
import { McpToken } from './infrastructure/mcp/token'
import { createMcpRoutes, registrationCommand } from './ipc/mcpHandlers'

export interface AppContext {
  readonly logger: Logger
  readonly secrets: SecretStore
  readonly database: DatabaseHandle
  readonly ai: AiEngine
  readonly examples: ExampleStore
  readonly neurons: NeuronService
  readonly appSettings: AppSettingsRepository
  /** Versions des widgets : lues par le protocole isolé `gi-widget://` (spec 004). */
  readonly widgets: WidgetRepository
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
  const hatchedRepository = new HatchedRepository(database.db)
  const growth = new GrowthService({
    repository: growthRepository,
    neurons,
    gateway: ai.gateway,
    emit: (event) => broadcast(event.type, event),
    document: (rootId) => hatchedRepository.result(rootId)
  })
  const summaries = new IdeaSummaryService({
    repository: growthRepository,
    gateway: ai.gateway,
    document: (rootId) => hatchedRepository.result(rootId)
  })
  const linkRepository = new LinkRepository(database.db)
  const seeds = new SeedService({
    repository: linkRepository,
    neurons,
    gateway: ai.gateway,
    examples,
    emit: (event) => broadcast(event.type, event)
  })
  const links = new LinkService({
    repository: linkRepository,
    gateway: ai.gateway,
    examples,
    seeds,
    emit: (event) => broadcast(event.type, event)
  })
  const widgetIoRepository = new WidgetIoRepository(database.db)
  const widgetRequestRepository = new WidgetRequestRepository(database.db)
  const blockRepository = new BlockRepository(database.db)
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
      onStale: (row) => broadcast('synthesis:stale', { rootId: row.rootId, synthesisId: row.id }),
      tools: {
        blocks: blockRepository,
        inputs: widgetIoRepository,
        requests: widgetRequestRepository,
        surroundings: (rootId) => toolSurroundings(canvas.get(), rootId)
      }
    }),
    links,
    emit: (event) => broadcast(event.type, event),
    existingTools: (rootId) => widgetIoRepository.toolsOf(rootId),
    onToolsCreated: (blockIds) => toolGeneration.start(blockIds)
  })

  const appSettings = new AppSettingsRepository(database.db)
  const widgetRepository = new WidgetRepository(database.db)
  const widgetIo = new WidgetIoService({
    repository: widgetIoRepository,
    widgets: widgetRepository,
    blocks: blockRepository,
    tree: (rootId) => (neuronRepository.root(rootId) === undefined ? undefined : neurons.getTree(rootId)),
    document: (rootId) => hatchedRepository.result(rootId)
  })
  const widgets = new WidgetService({
    repository: widgetRepository,
    gateway: ai.gateway,
    emit: (event) => broadcast(event.type, event),
    inputShape: (blockId) => widgetIo.inputShape(blockId),
    request: (blockId): WidgetRequestView | null => toolGeneration.view(blockId)
  })
  const toolGeneration = new ToolGeneration({
    requests: widgetRequestRepository,
    widgets,
    exists: (blockId) => widgetRepository.widget(blockId) !== undefined
  })
  const mapLinkRepository = new MapLinkRepository(database.db)
  const canvas = new CanvasService({
    neurons: neuronRepository,
    links: linkRepository,
    blocks: blockRepository,
    steps: hatchedRepository,
    io: widgetIo,
    mapLinks: mapLinkRepository
  })

  // Pont MCP (spec 007) : Claude Code lit et écrit la carte par un relais, via le canal nommé de ce profil.
  const selection = new SelectionStore()
  const mapService = new MapService({
    canvas: () => canvas.get(),
    tree: (rootId) => (neuronRepository.root(rootId) === undefined ? undefined : neurons.getTree(rootId)),
    blocks: blockRepository,
    mapLinks: mapLinkRepository,
    neurons: neuronRepository,
    selection,
    widgetFromCode: (blockId, code) => widgets.createFromCode(blockId, code),
    connectIdea: (blockId, rootId, parts) =>
      widgetIoRepository.insertInput({ blockId, sourceKind: 'idea', sourceId: rootId, parts }).id,
    categorize: (rootId) => neurons.categorizeInBackground(rootId),
    emit: (event) => broadcast('map:changed', event)
  })
  const mcpToken = new McpToken(tokenPathFor(dataDir))
  const pipe = new PipeServer({
    pipeName: pipeNameFor(dataDir),
    matchesToken: (candidate) => mcpToken.matches(candidate),
    handle: (tool, args) => mapService.handle(tool, args),
    logger
  })
  pipe.start().catch(() => logger.error('mcp.listen_failed', {}))
  const command = registrationCommand({
    electronPath: process.execPath,
    relayPath: join(import.meta.dirname, 'mcp-relay.js'),
    profileDir: dataDir
  })
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
      ...createSummaryRoutes(summaries),
      ...createFusionRoutes(fusion),
      ...createLinkRoutes(links),
      ...createSeedRoutes(seeds),
      ...createCanvasRoutes(canvas),
      ...createHistoryRoutes(new HistoryService(new HistoryRepository(database.db))),
      ...createHatchedRoutes(hatchedRepository),
      ...createWidgetRoutes(widgets, toolGeneration),
      ...createWidgetIoRoutes(widgetIo),
      ...createMcpRoutes({
        selection,
        status: () => ({ listening: pipe.listening(), clients: pipe.clients(), command }),
        rotateToken: () => {
          mcpToken.rotate()
          pipe.disconnectAll()
        }
      })
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
    widgets: widgetRepository,
    stop: () => {
      stopWatching()
      ai.stop()
      void pipe.stop()
    }
  }
}
