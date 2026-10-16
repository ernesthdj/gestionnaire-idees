import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AgentProfileService } from '../../../src/main/application/agents/AgentProfileService'
import { openDatabase, type DatabaseHandle } from '../../../src/main/infrastructure/db/client'
import { AgentProfileRepository } from '../../../src/main/infrastructure/db/repositories/AgentProfileRepository'
import type { AgentProfileInput } from '../../../src/shared/agents/profile'

const MIGRATIONS = resolve(import.meta.dirname, '../../../src/main/infrastructure/db/migrations')

const profile = (patch: Partial<AgentProfileInput> = {}): AgentProfileInput => ({
  name: 'Architecte',
  role: 'architecte',
  instructions: '  Découpe la spec.  ',
  permissionMode: 'default',
  model: 'claude-opus-5-5',
  effort: 'high',
  skills: ['perso:revue'],
  ...patch
})

describe('profils d’agents', () => {
  let root: string
  let handle: DatabaseHandle
  let service: AgentProfileService
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-agents-'))
    handle = openDatabase({ file: join(root, 'a.db'), key: '4'.repeat(64), migrationsFolder: MIGRATIONS })
    service = new AgentProfileService({
      repository: new AgentProfileRepository(handle.db),
      skillIds: () => new Set(['perso:revue', 'perso:tests'])
    })
  })
  afterEach(() => {
    handle.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('should_create_list_update_and_remove_a_profile', () => {
    const created = service.save(profile())
    expect(created).toMatchObject({ name: 'Architecte', instructions: 'Découpe la spec.', skills: ['perso:revue'] })
    expect(service.list()).toHaveLength(1)

    const updated = service.save(profile({ id: created.id, effort: 'max', skills: ['perso:revue', 'perso:tests'] }))
    expect(updated.effort).toBe('max')
    expect(updated.skills).toEqual(['perso:revue', 'perso:tests'])
    expect(service.list()).toHaveLength(1)

    service.remove(created.id)
    expect(service.list()).toEqual([])
  })

  it('should_refuse_a_duplicate_name_and_an_unknown_skill', () => {
    service.save(profile())
    expect(() => service.save(profile())).toThrow(/s’appelle déjà/)
    expect(() => service.save(profile({ name: 'QA', skills: ['perso:inconnu'] }))).toThrow(/n’existe plus/)
  })
})
