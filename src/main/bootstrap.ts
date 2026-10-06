import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, dialog, ipcMain, safeStorage, shell as electronShell } from 'electron'
import { ContextImportService } from './application/ai/ContextImportService'
import { CaptureService } from './application/capture/CaptureService'
import { CanvasService } from './application/canvas/CanvasService'
import { HistoryService } from './application/history/HistoryService'
import { ExampleStore } from './application/ai/ExampleStore'
import { NeuronService } from './application/neurons/NeuronService'
import { createAiEngine, type AiEngine } from './composition/aiEngine'
import { resolveOllamaUrl } from './infrastructure/ai/OllamaProvider'
import { InboxFolder } from './infrastructure/context-inbox/InboxFolder'
import { watchInbox } from './infrastructure/context-inbox/InboxWatcher'
import { ContextRepository } from './infrastructure/db/repositories/ContextRepository'
import { NeuronRepository } from './infrastructure/db/repositories/NeuronRepository'
import { AppSettingsRepository } from './infrastructure/db/repositories/AppSettingsRepository'
import { BlockRepository } from './infrastructure/db/repositories/BlockRepository'
import { HistoryRepository } from './infrastructure/db/repositories/HistoryRepository'
import { HatchedRepository } from './infrastructure/db/repositories/HatchedRepository'
import { LegacyRepository } from './infrastructure/db/repositories/LegacyRepository'
import { PlanRepository } from './infrastructure/db/repositories/PlanRepository'
import { PlanService } from './application/plan/PlanService'
import { createPlanRoutes } from './ipc/planHandlers'
import { createDocumentRoutes } from './ipc/documentHandlers'
import { openDatabase, type DatabaseHandle } from './infrastructure/db/client'
import { convertLegacyIdeas } from './application/conversation/LegacyConversion'
import { createLogger, stdoutSink, type Logger } from './infrastructure/logging/logger'
import { SecretStore } from './infrastructure/secrets/SecretStore'
import { createAiRoutes, LEGACY_CLAUDE_SECRET } from './ipc/aiHandlers'
import { createAppRoutes } from './ipc/appHandlers'
import { createCaptureRoutes } from './ipc/captureHandlers'
import { createCanvasRoutes } from './ipc/canvasHandlers'
import { createHistoryRoutes } from './ipc/historyHandlers'
import { createContextRoutes } from './ipc/contextHandlers'
import { createNeuronRoutes } from './ipc/neuronHandlers'
import { registerRoutes } from './ipc/registry'
import { createWidgetRoutes } from './ipc/widgetHandlers'
import { createWidgetIoRoutes } from './ipc/widgetIoHandlers'
import { WidgetIoService } from './application/widgets/WidgetIoService'
import { WidgetIoRepository } from './infrastructure/db/repositories/WidgetIoRepository'
import { WidgetService } from './application/widgets/WidgetService'
import { WidgetRepository } from './infrastructure/db/repositories/WidgetRepository'
import type { MainWindowEvent } from '@shared/ipc/channels'
import { MapService } from './application/mcp/MapService'
import { NeuronTools } from './application/mcp/NeuronTools'
import { PlanTools } from './application/mcp/PlanTools'
import { DocumentTools, fileLabel } from './application/mcp/DocumentTools'
import { ExecutionService } from './application/finals/ExecutionService'
import { ProjectFiles } from './infrastructure/finals/ProjectFiles'
import { CommandService } from './application/finals/CommandService'
import { DeliverableReader } from './application/finals/DeliverableReader'
import { PermissionService } from './application/conversation/PermissionService'
import { PermissionRepository } from './infrastructure/db/repositories/PermissionRepository'
import { projectKey } from './domain/conversation/permissions'
import { EditorService } from './application/finals/EditorService'
import { detectEditors, isProgram, launchEditor } from './infrastructure/editor/EditorLauncher'
import { CommandRepository } from './infrastructure/db/repositories/CommandRepository'
import { resolveNpm, runCommand } from './infrastructure/finals/CommandRunner'
import { DocumentService } from './application/documents/DocumentService'
import { DocumentRepository } from './infrastructure/db/repositories/DocumentRepository'
import { DocumentFiles } from './infrastructure/documents/DocumentFiles'
import { createToolHandler } from './application/mcp/toolHandler'
import { FinalTools } from './application/mcp/FinalTools'
import { FinalService } from './application/finals/FinalService'
import { FinalRepository } from './infrastructure/db/repositories/FinalRepository'
import { createFinalRoutes } from './ipc/finalHandlers'
import { ConversationService } from './application/conversation/ConversationService'
import { BRAINSTORMER_FRAME } from './application/conversation/frame'
import { ConversationRepository } from './infrastructure/db/repositories/ConversationRepository'
import { resolveClaudePath } from './infrastructure/claude/claudePath'
import { spawnClaudeConversation } from './infrastructure/claude/CliConversation'
import { createChatRoutes } from './ipc/chatHandlers'
import { createStructureRoutes } from './ipc/structureHandlers'
import { StructureService } from './application/structure/StructureService'
import { ElementRepository } from './infrastructure/db/repositories/ElementRepository'
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
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

  // Spec 010 US3 : les idées de l'ancien moteur reçoivent une fiche, une seule fois (annulable dans l'Historique).
  const conversion = convertLegacyIdeas(new LegacyRepository(database.db))
  if (conversion.batchId !== null) {
    logger.info('legacy.converted', {
      sheets: conversion.sheets,
      links: conversion.links,
      stepInputs: conversion.stepInputs
    })
  }

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

  // Spec 010 : plus de clé API Anthropic ; l'ancien secret est effacé s'il existe encore.
  secrets.delete(LEGACY_CLAUDE_SECRET)
  const ai = createAiEngine({
    db: database.db,
    logger,
    ollamaUrl: ollama.url,
    cliSandbox: join(dataDir, 'cli-sandbox'),
    contextSource: (kind) => contextService.activeContext(kind),
    // Rejeu de la file locale (ex. catégorisation d'une idée capturée pendant qu'Ollama était arrêté).
    onQueuedCompleted: (requestId, data) => neuronsRef.current?.applyQueuedResult(requestId, data)
  })

  const aiRoutes = createAiRoutes({
    config: ai.config,
    ollamaStatus: () => ai.ollama.isAvailable(),
    claudeStatus: () => ai.claude.isAvailable()
  })
  const neuronRepository = new NeuronRepository(database.db)
  const neurons = new NeuronService({ repository: neuronRepository, gateway: ai.gateway })
  neuronsRef.current = neurons
  const hatchedRepository = new HatchedRepository(database.db)
  const widgetIoRepository = new WidgetIoRepository(database.db)
  const blockRepository = new BlockRepository(database.db)

  const appSettings = new AppSettingsRepository(database.db)
  const widgetRepository = new WidgetRepository(database.db)
  const widgetIo = new WidgetIoService({
    repository: widgetIoRepository,
    widgets: widgetRepository,
    blocks: blockRepository,
    tree: (rootId) => (neuronRepository.root(rootId) === undefined ? undefined : neurons.getTree(rootId)),
    document: (rootId) => hatchedRepository.result(rootId),
    // Contexte des plans d'attaque (spec 015) : lu à la demande, une fois l'app démarrée (dépôts créés plus bas).
    context: {
      node: (id) => planRepository.node(id),
      steps: (genesisId) => planRepository.steps(genesisId),
      sheetJson: (id) => planRepository.sheetJson(id),
      whyOf: (stepId) => planRepository.whyOf(stepId),
      final: (stepId) => {
        const action = finalRepository.get(stepId)
        if (action === undefined || action.state === 'proposee') return null
        return {
          deliverable: action.deliverable,
          state: action.state,
          files: finalRepository
            .files(stepId)
            .filter((file) => file.revertedAt === null)
            .map((file) => ({ path: file.path, status: file.beforeContent === null ? 'cree' : 'modifie' }))
        }
      },
      documents: (neuronIds) =>
        documentRepository
          .list()
          .filter((document) => neuronIds.has(document.neuronId))
          .map((document) => {
            const { content, missing } = documents.read(document.id)
            return { title: document.title, content, ...(missing ? { missing: true as const } : {}) }
          })
    }
  })
  const widgets = new WidgetService({
    repository: widgetRepository,
    gateway: ai.gateway,
    emit: (event) => broadcast(event.type, event),
    inputShape: (blockId) => widgetIo.inputShape(blockId)
  })
  const mapLinkRepository = new MapLinkRepository(database.db)
  const elementRepository = new ElementRepository(database.db)
  const conversationRepository = new ConversationRepository(database.db)
  const planRepository = new PlanRepository(database.db)
  // Documents Markdown des neurones (spec 012) : vrais fichiers, dossier choisi ici, jamais par Claude ni l'interface.
  const documentRepository = new DocumentRepository(database.db)
  const documents = new DocumentService({
    repository: documentRepository,
    files: new DocumentFiles({ profileDir: dataDir }),
    nodes: planRepository,
    projectDir: (genesisId) => conversationRepository.neuron(genesisId)?.projectDir ?? null
  })
  // Actions finales (spec 013) : une étape feuille devient exécutable sur proposition de Claude, acceptée par mentalyas.
  const finalRepository = new FinalRepository(database.db)
  const finals = new FinalService({ repository: finalRepository, plan: planRepository })
  const plan = new PlanService({ repository: planRepository, finals })
  const projectDirOf = (genesisId: string): string | null =>
    conversationRepository.neuron(genesisId)?.projectDir ?? null
  const projectFiles = new ProjectFiles({ profileDir: dataDir })
  // Scripts approuvés (spec 013 D2 bis) : `npm run <script>` lancé par node + npm-cli.js, jamais par un shell.
  const commandRepository = new CommandRepository(database.db)
  const commands = new CommandService({
    commands: commandRepository,
    finals: finalRepository,
    projectDir: projectDirOf,
    files: projectFiles,
    run: async (cwd, script) => {
      const npm = resolveNpm()
      if (npm === null) {
        return {
          exitCode: null,
          timedOut: false,
          durationMs: 0,
          output: 'npm introuvable : installe Node.js (avec npm).'
        }
      }
      return runCommand({ command: npm.node, args: [npm.cli, 'run', script], cwd })
    },
    emit: (neuronId) => broadcast('final:changed', { neuronId })
  })
  // Exécutions (spec 013 US2) : Claude écrit dans le projet lié par les outils de l'app, pendant un tour seulement.
  const executions = new ExecutionService({
    repository: finalRepository,
    plan: planRepository,
    projectDir: projectDirOf,
    documents: (ids) =>
      documentRepository
        .list()
        .filter((document) => ids.has(document.neuronId))
        .map((document) => ({ id: document.id, title: document.title, fileLabel: fileLabel(document) })),
    files: projectFiles,
    scripts: (genesisId) => commands.runnable(genesisId),
    // La conversation est créée plus bas : ces appels n'ont lieu qu'au lancement d'une exécution.
    conversations: {
      send: (neuronId, text, data) => conversations.send(neuronId, text, data),
      stop: (neuronId) => conversations.stop(neuronId),
      isBusy: (neuronId) => conversations.isBusy(neuronId)
    },
    emit: (neuronId) => broadcast('final:changed', { neuronId })
  })
  executions.recover()
  const canvas = new CanvasService({
    plan: planRepository,
    documents: documentRepository,
    finals: {
      list: () => finalRepository.list(),
      files: (neuronId) => finalRepository.files(neuronId),
      runs: (neuronId) => commandRepository.runsOf(neuronId),
      projectLinked: (genesisId) => projectDirOf(genesisId) !== null
    },
    neurons: neuronRepository,
    blocks: blockRepository,
    io: widgetIo,
    mapLinks: mapLinkRepository,
    sheetSummaries: () => conversationRepository.sheetSummaries(),
    elements: elementRepository
  })

  // Cartes de structure des projets liés (spec 009) : un élément appartient au projet de son genesis.
  const genesisOf = (neuronId: string): string | undefined => {
    const neuron = conversationRepository.neuron(neuronId)
    if (neuron === undefined) return undefined
    if (neuron.kind === 'root') return neuron.id
    return neuron.genesisId ?? undefined
  }
  const structure = new StructureService({
    elements: elementRepository,
    links: mapLinkRepository,
    genesisOf,
    genesisTitle: (genesisId) => {
      const root = neuronRepository.root(genesisId)
      return root === undefined || root.state === 'archived' ? undefined : root.title
    },
    emit: (event) => broadcast('map:changed', event)
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
    connectSource: (blockId, sourceKind, sourceId, parts) =>
      widgetIoRepository.insertInput({ blockId, sourceKind, sourceId, parts }).id,
    categorize: (rootId) => neurons.categorizeInBackground(rootId),
    emit: (event) => broadcast('map:changed', event)
  })
  // Demandes de permission de Claude Code relayées dans le chat (spec 014) ; règles « Toujours » par projet.
  const permissions: PermissionService = new PermissionService({
    repository: new PermissionRepository(database.db),
    projectKeyOf: (neuronId: string): string => {
      const dir: string = conversations.workingDir(neuronId)
      return projectKey(existsSync(dir) ? realpathSync(dir) : dir)
    },
    emit: (event) => broadcast(event.type, event.payload)
  })
  const mcpToken = new McpToken(tokenPathFor(dataDir))
  const pipe = new PipeServer({
    pipeName: pipeNameFor(dataDir),
    matchesToken: (candidate) => mcpToken.matches(candidate),
    handle: createToolHandler(
      mapService,
      new NeuronTools({
        conversations: conversationRepository,
        insertAssessment: (input) => conversationRepository.insertAssessment(input),
        onChanged: (neuronId) => broadcast('chat:sheet', { neuronId }),
        plan: planRepository,
        documents: documentRepository,
        finals
      }),
      structure,
      new PlanTools({
        plan,
        conversations: conversationRepository,
        onProposed: (summary) => broadcast('plan:proposed', { summary })
      }),
      new DocumentTools({
        documents,
        repository: documentRepository,
        conversations: conversationRepository,
        onWritten: (event) => broadcast('map:changed', event)
      }),
      new FinalTools({
        finals,
        executions,
        commands,
        conversations: conversationRepository,
        onProposed: (summary) => broadcast('final:proposed', { summary })
      }),
      permissions
    ),
    logger
  })
  pipe.start().catch(() => logger.error('mcp.listen_failed', {}))
  const relayPath = join(import.meta.dirname, 'mcp-relay.js')
  const command = registrationCommand({ electronPath: process.execPath, relayPath, profileDir: dataDir })

  // Conversations Claude Code des neurones (spec 008) : le vrai CLI, dans le dossier de travail de l'app.
  const workspace = join(dataDir, 'workspace')
  mkdirSync(workspace, { recursive: true })
  const conversations = new ConversationService({
    repository: conversationRepository,
    spawn: spawnClaudeConversation,
    claudePath: resolveClaudePath,
    settings: () => ({
      cwd: workspace,
      model: ai.config.get().claudeModel,
      elementModel: ai.config.get().elementModel,
      electronPath: process.execPath,
      relayPath,
      profileDir: dataDir
    }),
    frame: BRAINSTORMER_FRAME,
    permissions,
    emit: (event) => {
      broadcast(event.type, event.payload)
      executions.onChatEvent(event)
    },
    // Le chemin d'un dossier de projet vient uniquement du sélecteur natif, jamais de l'interface (constitution I).
    pickFolder: async () => {
      const result = await dialog.showOpenDialog({
        title: 'Lier un dossier de projet au neurone',
        properties: ['openDirectory']
      })
      return result.canceled ? undefined : result.filePaths[0]
    }
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
      ...createNeuronRoutes(neurons, plan),
      ...createPlanRoutes(plan),
      ...createFinalRoutes(
        finals,
        executions,
        commands,
        new DeliverableReader({ repository: finalRepository, projectDir: projectDirOf, files: projectFiles }),
        // Éditeur (spec 013 D4) : programme connu ou choisi dans le dialogue natif, jamais venu de l'interface.
        new EditorService({
          settings: appSettings,
          detect: () => detectEditors(),
          chooseProgram: async () => {
            const result = await dialog.showOpenDialog({
              title: 'Choisir le programme de l’éditeur',
              properties: ['openFile'],
              filters: [{ name: 'Programmes', extensions: ['exe'] }]
            })
            return result.canceled ? null : (result.filePaths[0] ?? null)
          },
          isProgram,
          launch: launchEditor,
          openPath: (path) => electronShell.openPath(path),
          repository: finalRepository,
          projectDir: projectDirOf,
          files: projectFiles
        })
      ),
      ...createDocumentRoutes({ documents, reveal: (path) => electronShell.showItemInFolder(path) }),
      ...createCanvasRoutes(canvas),
      ...createHistoryRoutes(
        new HistoryService(new HistoryRepository(database.db), {
          ...documents.historyHandlers(),
          ...finals.historyHandlers(),
          ...executions.historyHandlers()
        })
      ),
      ...createWidgetRoutes(widgets),
      ...createWidgetIoRoutes(widgetIo),
      ...createChatRoutes(conversations, permissions),
      ...createStructureRoutes(structure),
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
      conversations.stopAll()
      permissions.cancelAll()
      void pipe.stop()
    }
  }
}
