import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { createAiEngine, type AiEngine } from './composition/aiEngine'
import { openDatabase, type DatabaseHandle } from './infrastructure/db/client'
import { createLogger, stdoutSink, type Logger } from './infrastructure/logging/logger'
import { SecretStore } from './infrastructure/secrets/SecretStore'
import { createAiRoutes } from './ipc/aiHandlers'
import { appRoutes } from './ipc/appHandlers'
import { registerRoutes } from './ipc/registry'
import type { MainWindowEvent } from '@shared/ipc/channels'

export interface AppContext {
  readonly logger: Logger
  readonly secrets: SecretStore
  readonly database: DatabaseHandle
  readonly ai: AiEngine
}

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'

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

  const ai = createAiEngine({
    db: database.db,
    secrets,
    logger,
    ollamaUrl: process.env['OLLAMA_URL'] ?? DEFAULT_OLLAMA_URL,
    onBudgetAlert: (spentCents, capCents) => broadcast('ai:budgetAlert', { spentCents, capCents }),
    // Rejeu de la file locale : consommé par la capture (spec 003).
    onQueuedCompleted: () => undefined
  })

  const aiRoutes = createAiRoutes({
    config: ai.config,
    secrets,
    ollamaStatus: () => ai.ollama.isAvailable(),
    claudePing: () => ai.claude.ping(),
    spentMillicentsThisMonth: () => ai.spentMillicentsThisMonth(),
    now: () => new Date()
  })
  registerRoutes(ipcMain, [...appRoutes, ...aiRoutes], logger)
  logger.info('app.ready', { version: app.getVersion() })
  return { logger, secrets, database, ai }
}
