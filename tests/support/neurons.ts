import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { NeuronService } from '../../src/main/application/neurons/NeuronService'
import { openDatabase, type DatabaseHandle } from '../../src/main/infrastructure/db/client'
import { NeuronRepository } from '../../src/main/infrastructure/db/repositories/NeuronRepository'
import { createGatewayHarness, type GatewayHarness } from './gateway'

const MIGRATIONS = resolve(import.meta.dirname, '../../src/main/infrastructure/db/migrations')

export interface NeuronHarness {
  readonly h: GatewayHarness
  readonly neurons: NeuronService
  readonly handle: DatabaseHandle
  /** Rouvre le service sur la même base (simulation d'un redémarrage). */
  reopen(): NeuronService
  dispose(): void
}

/** Base chiffrée temporaire et service des idées, IA simulée (la catégorisation locale reste arrêtée). */
export function createNeuronHarness(): NeuronHarness {
  const dir = mkdtempSync(join(tmpdir(), 'gi-neurons-'))
  const file = join(dir, 'g.db')
  const key = '5'.repeat(64)
  let handle = openDatabase({ file, key, migrationsFolder: MIGRATIONS })
  const h = createGatewayHarness()
  h.ollama.setAvailable(false)
  const build = (db: DatabaseHandle): NeuronService =>
    new NeuronService({ repository: new NeuronRepository(db.db), gateway: h.gateway })
  const neurons = build(handle)
  return {
    h,
    neurons,
    get handle() {
      return handle
    },
    reopen: () => {
      handle.close()
      handle = openDatabase({ file, key, migrationsFolder: MIGRATIONS })
      return build(handle)
    },
    dispose: () => {
      handle.close()
      rmSync(dir, { recursive: true, force: true })
    }
  }
}
