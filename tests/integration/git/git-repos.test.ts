import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildScenario, git, SCENARIOS } from '../../support/gitRepos'

describe('dépôts git fictifs des tests (spec 021 T002)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gi-git-repos-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it.each(SCENARIOS)('should_build_the_%s_scenario_when_asked', (scenario) => {
    const repo = buildScenario(join(root, scenario), scenario)
    expect(existsSync(repo)).toBe(true)
  })

  it('should_keep_fake_identities_and_old_secrets_in_history_only', () => {
    const repo = join(root, 'trois-auteurs')
    const emails = git(repo, ['log', '--format=%ae']).trim().split('\n')
    expect(emails.every((email) => email.toLowerCase().endsWith('@example.invalid'))).toBe(true)
    const secrets = join(root, 'secret-ancien')
    expect(existsSync(join(secrets, '.env'))).toBe(false)
    expect(git(secrets, ['log', '--format=%s']).trim().split('\n')).toHaveLength(4)
  })
})
