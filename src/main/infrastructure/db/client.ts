// 'better-sqlite3' est un alias npm de better-sqlite3-multiple-ciphers (SQLite chiffré) : voir package.json.
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as aiSchema from './schema'
import * as neuronSchema from './schemaNeurons'
import * as repriseSchema from './schemaReprise'
import * as analysteSchema from './schemaAnalyste'
import * as skillsSchema from './schemaSkills'

const schema = { ...aiSchema, ...neuronSchema, ...repriseSchema, ...analysteSchema, ...skillsSchema }

export type AppDatabase = BetterSQLite3Database<typeof schema>

export interface DatabaseHandle {
  readonly db: AppDatabase
  close(): void
}

export interface OpenDatabaseOptions {
  readonly file: string
  /** Clé hexadécimale de 64 caractères (32 octets), issue du SecretStore. */
  readonly key: string
  readonly migrationsFolder: string
}

const HEX_KEY = /^[0-9a-f]{64}$/

/** Ouvre la base SQLite chiffrée (SQLCipher), vérifie la clé et applique les migrations. */
export function openDatabase({ file, key, migrationsFolder }: OpenDatabaseOptions): DatabaseHandle {
  // La clé est interpolée dans un PRAGMA (non paramétrable) : on n'accepte qu'un format hexadécimal strict.
  if (!HEX_KEY.test(key)) throw new Error('Clé de base de données invalide')

  const sqlite = new Database(file)
  try {
    sqlite.pragma("cipher='sqlcipher'")
    sqlite.pragma(`key="x'${key}'"`)
    // Lecture de contrôle : échoue immédiatement si la clé ne correspond pas.
    sqlite.prepare('SELECT count(*) FROM sqlite_master').get()
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')

    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder })
    return { db, close: () => sqlite.close() }
  } catch (error) {
    sqlite.close()
    throw error
  }
}
