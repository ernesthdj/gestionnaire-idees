import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AppError } from '../../domain/errors'

/** Sous-ensemble de `safeStorage` d'Electron (DPAPI sous Windows), injectable pour les tests. */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

const SECRET_NAME = /^[a-z][a-z0-9-]{0,31}$/

/** Secrets chiffrés par le système, un fichier par secret, jamais en clair sur disque. */
export class SecretStore {
  constructor(
    private readonly directory: string,
    private readonly storage: SafeStorageLike
  ) {}

  get(name: string): string | null {
    const file = this.pathOf(name)
    if (!existsSync(file)) return null
    return this.storage.decryptString(readFileSync(file))
  }

  set(name: string, value: string): void {
    const file = this.pathOf(name)
    if (!this.storage.isEncryptionAvailable()) {
      throw new AppError('ENCRYPTION_UNAVAILABLE', 'Le chiffrement du système est indisponible')
    }
    mkdirSync(this.directory, { recursive: true })
    writeFileSync(file, this.storage.encryptString(value), { mode: 0o600 })
  }

  delete(name: string): void {
    rmSync(this.pathOf(name), { force: true })
  }

  /** Clé aléatoire de 32 octets (hexadécimal), créée au premier appel puis réutilisée. */
  getOrCreateRandomKey(name: string): string {
    const existing = this.get(name)
    if (existing !== null) return existing
    const key = randomBytes(32).toString('hex')
    this.set(name, key)
    return key
  }

  private pathOf(name: string): string {
    if (!SECRET_NAME.test(name)) throw new Error(`Nom de secret invalide : ${name}`)
    return join(this.directory, `${name}.bin`)
  }
}
