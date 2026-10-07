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
import { createLogger, stdoutSink, teeSink, type Logger } from './infrastructure/logging/logger'
import { ProbeService } from './application/analyste/ProbeService'
import { RepoGuard } from './application/analyste/RepoGuard'
import { AnalysteRepository } from './infrastructure/db/repositories/AnalysteRepository'
import { ObservationRepository } from './infrastructure/db/repositories/ObservationRepository'
import { createAnalysteRoutes } from './ipc/analysteHandlers'
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
import { DeliverableTracker } from './application/finals/DeliverableTracker'
import { ConfidentialityGuard } from './application/reprise/ConfidentialityGuard'
import { RepriseService } from './application/reprise/RepriseService'
import { AnalysisService } from './application/reprise/AnalysisService'
import { CodeGraphTools } from './application/reprise/CodeGraphTools'
import { ElementFilesService } from './application/reprise/ElementFilesService'
import { ExplorerService } from './application/reprise/ExplorerService'
import { createExplorerRoutes } from './ipc/explorerHandlers'
import { analysisWorker } from './infrastructure/reprise/AnalysisWorker'
import { CodeGraphRepository } from './infrastructure/db/repositories/CodeGraphRepository'
import { scanProject } from './infrastructure/reprise/ProjectScanner'
import { ProjectFileIndex } from './infrastructure/reprise/ProjectFileIndex'
import { createRepriseRoutes } from './ipc/repriseHandlers'
import { GuideService } from './application/reprise/GuideService'
import { runRepriseGuide } from './application/ai/RepriseGuideTask'
import { readProjectText } from './infrastructure/reprise/projectText'
import { maskLocalProjects } from './domain/reprise/maskLocal'
import { RepriseRepository } from './infrastructure/db/repositories/RepriseRepository'
import { ProjectFiles } from './infrastructure/finals/ProjectFiles'
import { DeliverableReader } from './application/finals/DeliverableReader'
import { DeliverableService } from './application/finals/DeliverableService'
import { PermissionService } from './application/conversation/PermissionService'
import { PermissionRepository } from './infrastructure/db/repositories/PermissionRepository'
import { projectKey } from './domain/conversation/permissions'
import { EditorService } from './application/finals/EditorService'
import { detectEditors, isProgram, launchEditor } from './infrastructure/editor/EditorLauncher'
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
import { createProjectRoutes } from './ipc/projectHandlers'
import { ProjectService } from './application/projects/ProjectService'
import { runGit } from './infrastructure/projects/GitCli'
import { createStructureRoutes } from './ipc/structureHandlers'
import { StructureService } from './application/structure/StructureService'
import { ElementRepository } from './infrastructure/db/repositories/ElementRepository'
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs'
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
  // La sonde de l'Analyste (spec 019) est créée après la base : le journal la rejoint dès qu'elle existe.
  const probeRef: { current?: ProbeService } = {}
  const logger = createLogger(teeSink(stdoutSink, (record) => probeRef.current?.recordLog(record.level, record.event)))
  const dataDir = app.getPath('userData')
  const secrets = new SecretStore(join(dataDir, 'secrets'), safeStorage)

  const database = openDatabase({
    file: join(dataDir, 'gestionnaire-idees.db'),
    key: secrets.getOrCreateRandomKey('db'),
    migrationsFolder: migrationsFolder()
  })

  // Analyste interne (spec 019) : sonde sans contenu, active seulement depuis le dépôt source désigné.
  const analysteRepository = new AnalysteRepository(database.db)
  const observationRepository = new ObservationRepository(database.db)
  const repoGuard = new RepoGuard({
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    git: runGit,
    storedRepo: () => analysteRepository.repoPath(),
    storeRepo: (path) => analysteRepository.saveRepoPath(path),
    secrets
  })
  const probe = new ProbeService({
    key: () => repoGuard.hmacKey(),
    repository: observationRepository,
    settings: () => analysteRepository.settings(),
    timers: { every: (ms, run) => setInterval(run, ms), cancel: (handle) => clearInterval(handle as NodeJS.Timeout) },
    recheck: () => repoGuard.check()
  })
  probeRef.current = probe
  if (!app.isPackaged) {
    probe.start()
    void repoGuard.check().catch(() => logger.warn('analyste.repo_check_failed', {}))
  }

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
  // Projets repris (spec 017) : un projet « Local uniquement » n'est jamais transmis à Claude (garde unique, R5).
  const repriseRepository = new RepriseRepository(database.db)
  const confidentiality = new ConfidentialityGuard({
    neuron: (id) => conversationRepository.neuron(id),
    project: (genesisId) => repriseRepository.project(genesisId),
    documentNeuron: (documentId) => documentRepository.get(documentId)?.neuronId
  })
  const documents = new DocumentService({
    repository: documentRepository,
    files: new DocumentFiles({ profileDir: dataDir }),
    nodes: planRepository,
    // Un projet repris n'est jamais modifié (spec 017 FR-030) : ses documents vivent dans le profil.
    projectDir: (genesisId) =>
      repriseRepository.project(genesisId) === undefined
        ? (conversationRepository.neuron(genesisId)?.projectDir ?? null)
        : null
  })
  // Actions finales (spec 013) : une étape feuille devient exécutable sur proposition de Claude, acceptée par mentalyas.
  const finalRepository = new FinalRepository(database.db)
  const finals = new FinalService({ repository: finalRepository, plan: planRepository })
  const plan = new PlanService({ repository: planRepository, finals })
  const projectDirOf = (genesisId: string): string | null =>
    conversationRepository.neuron(genesisId)?.projectDir ?? null
  const projectFiles = new ProjectFiles({ profileDir: dataDir })
  // Exécutions (spec 013 US2, spec 014) : un tour de la conversation de l'action, dans son mode de permission.
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
    // La conversation est créée plus bas : ces appels n'ont lieu qu'au lancement d'une exécution.
    conversations: {
      send: (neuronId, text, data) => conversations.send(neuronId, text, data),
      stop: (neuronId) => conversations.stop(neuronId),
      isBusy: (neuronId) => conversations.isBusy(neuronId)
    },
    emit: (neuronId) => broadcast('final:changed', { neuronId })
  })
  executions.recover()
  // Revue du livrable (spec 013 US3) : accepter, corriger, revenir en arrière.
  const deliverableReview = new DeliverableService({
    repository: finalRepository,
    plan: planRepository,
    projectDir: projectDirOf,
    files: projectFiles,
    executions,
    emit: (neuronId) => broadcast('final:changed', { neuronId })
  })
  // Livrable reconstitué à partir des écritures réelles de Claude (hook avant écriture, spec 014 R5).
  const deliverables = new DeliverableTracker({
    finals: finalRepository,
    projectDir: projectDirOf,
    files: projectFiles,
    record: (neuronId, relative, before, next) => executions.recordWrite(neuronId, relative, before, next)
  })
  // Graphe des projets repris (spec 017) ; l'explorateur le charge une fois, vidé du cache à chaque analyse ou
  // correction, et donne aussi à la carte les appels mesurés entre ses éléments (US7).
  const codeGraph = new CodeGraphRepository(database.db)
  const explorer = new ExplorerService({ reprise: repriseRepository, graph: codeGraph })
  // Contenu des éléments de carte (spec 017 D18) : inventaire du dossier lié, fichiers sensibles déjà exclus.
  const projectFileIndex = new ProjectFileIndex({ scan: (root) => scanProject(root).retained.map((file) => file.path) })
  const canvas = new CanvasService({
    plan: planRepository,
    documents: documentRepository,
    finals: {
      list: () => finalRepository.list(),
      files: (neuronId) => finalRepository.files(neuronId),
      projectLinked: (genesisId) => projectDirOf(genesisId) !== null
    },
    neurons: neuronRepository,
    blocks: blockRepository,
    io: widgetIo,
    mapLinks: mapLinkRepository,
    sheetSummaries: () => conversationRepository.sheetSummaries(),
    elements: elementRepository,
    fileCalls: (genesisId) => explorer.fileCalls(genesisId),
    projectFiles: (genesisId) => {
      const dir = projectDirOf(genesisId)
      return dir === null ? [] : projectFileIndex.files(dir)
    }
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
    canvas: () => maskLocalProjects(canvas.get(), (genesisId) => confidentiality.isLocalGenesis(genesisId)),
    tree: (rootId) =>
      neuronRepository.root(rootId) === undefined || confidentiality.isLocalGenesis(rootId)
        ? undefined
        : neurons.getTree(rootId),
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
    handle: confidentiality.guardTools(
      createToolHandler(
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
          conversations: conversationRepository,
          onProposed: (summary) => broadcast('final:proposed', { summary })
        }),
        permissions,
        deliverables,
        new CodeGraphTools({
          genesisOf,
          project: (genesisId) => repriseRepository.project(genesisId),
          graph: codeGraph,
          fileCalls: (genesisId) => explorer.fileCalls(genesisId)
        })
      )
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
    defaultPermissionMode: () => appSettings.get().chatPermissionMode,
    claudeAllowed: (neuronId) => confidentiality.claudeAllowed(neuronId),
    repriseOf: (neuronId) => confidentiality.projectOf(neuronId),
    onToolResult: (neuronId, toolUseId, ok) => deliverables.after(neuronId, toolUseId, ok),
    finalOf: (neuronId) => {
      const action = finalRepository.get(neuronId)
      return action === undefined
        ? undefined
        : { state: action.state, files: finalRepository.files(neuronId).map((file) => file.path) }
    },
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
    },
    isGitRepo: (dir) => existsSync(join(dir, '.git'))
  })
  // Genesis → projet (spec 016) : racine choisie au sélecteur natif, dossier construit par le main.
  const projects = new ProjectService({
    settings: appSettings,
    pickRoot: async () => {
      const result = await dialog.showOpenDialog({
        title: 'Choisir la racine des projets (ex. le dossier projects de ProjectMaster)',
        properties: ['openDirectory', 'createDirectory']
      })
      return result.canceled ? undefined : result.filePaths[0]
    },
    neuron: (id) => conversationRepository.neuron(id),
    attach: (neuronId, dir) => conversations.attach(neuronId, dir),
    git: runGit
  })
  // Analyse des projets repris (spec 017 US3) : processus séparé, une analyse lourde à la fois.
  const analysis = new AnalysisService({
    reprise: repriseRepository,
    graph: codeGraph,
    scan: (root) => scanProject(root),
    runWorker: analysisWorker(join(import.meta.dirname, 'analysis-worker.js')),
    emit: (event) => {
      if (event.type === 'reprise:changed') explorer.invalidate(event.payload.genesisId)
      broadcast(event.type, event.payload)
      // Fin de la première analyse : le guide de reprise est rédigé (spec 017 US4) ; un échec reste dans son run.
      const genesisId = event.payload.genesisId
      if (
        event.type === 'reprise:analysisDone' &&
        repriseRepository.project(genesisId)?.guideDocumentId === null &&
        !guide.isRunning(genesisId)
      ) {
        guide.generate(genesisId).catch(() => logger.warn('reprise.guide_failed', {}))
      }
    }
  })
  analysis.recover()
  // Guide de reprise (spec 017 US4) : Claude ou le modèle local selon la confidentialité, document du genesis.
  const guide = new GuideService({
    reprise: repriseRepository,
    graph: codeGraph,
    documents,
    documentAlive: (documentId) => documentRepository.get(documentId)?.deletedAt === null,
    claudeAllowed: (genesisId) => confidentiality.claudeAllowed(genesisId),
    runGuide: (input, options) => runRepriseGuide(ai.gateway, input, options),
    readText: readProjectText,
    emit: (event) => broadcast(event.type, event.payload),
    onWritten: (event) => broadcast('map:changed', event)
  })
  // Fichiers d'un élément de carte (spec 017 US7) : lecture seule sous le dossier lié, symboles si le projet est analysé.
  const elementFiles = new ElementFilesService({
    neuron: (id) => conversationRepository.neuron(id),
    graph: codeGraph,
    scan: (root) => scanProject(root)
  })
  // Reprendre un projet existant (spec 017) : dossier choisi au sélecteur natif, genesis lié à son dossier source.
  const reprise = new RepriseService({
    repository: repriseRepository,
    pickFolder: async () => {
      const result = await dialog.showOpenDialog({
        title: 'Choisir le dossier du projet à reprendre',
        properties: ['openDirectory']
      })
      return result.canceled ? undefined : result.filePaths[0]
    },
    scan: (root) => scanProject(root),
    linkedFolders: () => conversationRepository.linkedFolders(),
    guide: (genesisId) => {
      const documentId = repriseRepository.project(genesisId)?.guideDocumentId ?? null
      return {
        documentId: documentId !== null && documentRepository.get(documentId)?.deletedAt === null ? documentId : null,
        running: guide.isRunning(genesisId)
      }
    },
    createGenesis: async (title) => (await neurons.create({ text: title })).id,
    attach: (neuronId, dir) => conversations.attach(neuronId, dir),
    dataDir,
    isArchived: (genesisId) => conversationRepository.neuron(genesisId)?.state === 'archived',
    onCreated: (genesisId) => {
      try {
        analysis.analyze(genesisId)
      } catch {
        // Dossier disparu entre-temps : mentalyas relancera l'analyse depuis l'explorateur.
      }
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
        }),
        deliverableReview
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
      ...createProjectRoutes(projects),
      ...createRepriseRoutes(reprise, analysis, guide),
      ...createExplorerRoutes(explorer),
      ...createStructureRoutes(structure, elementFiles),
      ...createAnalysteRoutes({
        guard: repoGuard,
        probe,
        observations: observationRepository,
        settings: analysteRepository,
        pickRepo: async () => {
          const result = await dialog.showOpenDialog({
            title: 'Choisir le dépôt source du Brainstormer',
            properties: ['openDirectory']
          })
          return result.canceled ? undefined : result.filePaths[0]
        },
        pickExportFile: async () => {
          const result = await dialog.showSaveDialog({
            title: 'Exporter les observations de la sonde',
            defaultPath: 'observations-analyste.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
          })
          return result.canceled ? undefined : result.filePath
        },
        writeFile: (path, content) => writeFileSync(path, content, 'utf8')
      }),
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
    rendererFileUrl,
    (channel, durationMs, ok) => probe.recordCall(channel, durationMs, ok)
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
      probe.stop()
      void pipe.stop()
    }
  }
}
