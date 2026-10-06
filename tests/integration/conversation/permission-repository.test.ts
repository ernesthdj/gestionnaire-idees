import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PermissionRepository } from '../../../src/main/infrastructure/db/repositories/PermissionRepository'
import { permissionLog } from '../../../src/main/infrastructure/db/schemaNeurons'
import { createNeuronHarness, type NeuronHarness } from '../../support/neurons'

describe('règles, confiance et journal des permissions (spec 014)', () => {
  let t: NeuronHarness
  let repository: PermissionRepository

  beforeEach(() => {
    t = createNeuronHarness()
    repository = new PermissionRepository(t.handle.db)
  })
  afterEach(() => t.dispose())

  it('should_keep_rules_per_project_without_duplicates_and_revoke_them', () => {
    repository.addRule('c:/p', { tool: 'Bash', pattern: 'npm test' })
    repository.addRule('c:/p', { tool: 'Bash', pattern: 'npm test' })
    repository.addRule('c:/p', { tool: 'Edit', pattern: null })
    repository.addRule('c:/autre', { tool: 'Bash', pattern: 'ls' })
    const rules = repository.rules('c:/p')
    expect(rules.map((rule) => [rule.tool, rule.pattern])).toEqual([
      ['Bash', 'npm test'],
      ['Edit', null]
    ])
    expect(repository.rules()).toHaveLength(3)
    expect(repository.removeRule(rules[0]?.id ?? '')).toBe(true)
    expect(repository.removeRule(rules[0]?.id ?? '')).toBe(false)
    expect(repository.rules('c:/p').map((rule) => rule.tool)).toEqual(['Edit'])
  })

  it('should_mark_and_unmark_a_trusted_project', () => {
    expect(repository.isTrusted('c:/p')).toBe(false)
    repository.setTrusted('c:/p', true)
    repository.setTrusted('c:/p', true)
    expect(repository.isTrusted('c:/p')).toBe(true)
    repository.setTrusted('c:/p', false)
    expect(repository.isTrusted('c:/p')).toBe(false)
  })

  it('should_log_only_the_tool_and_the_decision', () => {
    repository.log('n1', 'Bash', 'deny')
    const [row] = t.handle.db.select().from(permissionLog).all()
    expect(row).toMatchObject({ neuronId: 'n1', tool: 'Bash', decision: 'deny' })
    expect(Object.keys(row ?? {}).sort()).toEqual(['at', 'decision', 'id', 'neuronId', 'tool'])
  })
})
