import { join } from 'node:path'
import { app, ipcMain, safeStorage } from 'electron'
import { createAiEngine, type AiEngine } from './composition/aiEngine'
import { openDatabase, type DatabaseHandle } from './infrastructure/db/client'
import { createLogger, stdoutSink, type Logger } from './infrastructure/logging/logger'
import { SecretStore } from './infrastructure/secrets/SecretStore'
import { appRoutes } from './ipc/appHandlers'
import { registerRoutes } from './ipc/registry'

export interface AppContext {
  readonly logger: Logger
  readonly secrets: SecretStore
  readonly database: DatabaseHandle
  readonly ai: AiEngine
}

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'

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
    // Événements vers l'interface : branchés avec les écrans de réglages (US4) et la capture (spec 003).
    onBudgetAlert: () => undefined,
    onQueuedCompleted: () => undefined
  })

  registerRoutes(ipcMain, appRoutes, logger)
  logger.info('app.ready', { version: app.getVersion() })
  return { logger, secrets, database, ai }
}
