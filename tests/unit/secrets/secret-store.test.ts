import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SecretStore, type SafeStorageLike } from '../../../src/main/infrastructure/secrets/SecretStore'

/** Chiffrement simulé : inverse les octets et préfixe un marqueur (jamais le texte en clair). */
function fakeSafeStorage(available = true): SafeStorageLike {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plain) => Buffer.concat([Buffer.from('ENC:'), Buffer.from(plain, 'utf8').reverse()]),
    decryptString: (data) => Buffer.from(data.subarray(4)).reverse().toString('utf8')
  }
}

describe('SecretStore', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gi-secrets-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('should_roundtrip_secret_when_encryption_is_available', () => {
    const store = new SecretStore(dir, fakeSafeStorage())
    store.set('claude', 'sk-ant-fictive-000000000000000000')
    expect(store.get('claude')).toBe('sk-ant-fictive-000000000000000000')
  })

  it('should_never_write_plaintext_when_saving_secret', () => {
    const store = new SecretStore(dir, fakeSafeStorage())
    store.set('claude', 'sk-ant-fictive-000000000000000000')
    for (const file of readdirSync(dir)) {
      expect(readFileSync(join(dir, file)).includes(Buffer.from('sk-ant-fictive'))).toBe(false)
    }
  })

  it('should_return_null_when_secret_is_absent', () => {
    expect(new SecretStore(dir, fakeSafeStorage()).get('claude')).toBeNull()
  })

  it('should_delete_secret_when_cleared', () => {
    const store = new SecretStore(dir, fakeSafeStorage())
    store.set('claude', 'x')
    store.delete('claude')
    expect(store.get('claude')).toBeNull()
  })

  it('should_refuse_to_store_when_encryption_is_unavailable', () => {
    const store = new SecretStore(dir, fakeSafeStorage(false))
    expect(() => store.set('claude', 'x')).toThrow(expect.objectContaining({ code: 'ENCRYPTION_UNAVAILABLE' }))
  })

  it('should_reject_invalid_secret_name_when_it_could_escape_directory', () => {
    const store = new SecretStore(dir, fakeSafeStorage())
    expect(() => store.set('../evil', 'x')).toThrow(/nom de secret/i)
  })

  it('should_generate_and_reuse_random_key_when_asked_twice', () => {
    const store = new SecretStore(dir, fakeSafeStorage())
    const first = store.getOrCreateRandomKey('db')
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(store.getOrCreateRandomKey('db')).toBe(first)
  })
})
