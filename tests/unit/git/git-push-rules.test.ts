import { describe, expect, it } from 'vitest'
import { assertSafeArgs, pushArgs, fetchArgs, safeRef } from '../../../src/main/domain/git/args'
import { assertSafeGhArgs, ghLoginArgs, ghRepoCreateArgs, ghRepoViewArgs } from '../../../src/main/domain/git/ghArgs'
import { pushVerdict, unacceptedFindings } from '../../../src/main/domain/git/pushRules'
import type { Finding } from '../../../src/main/domain/git/sensitive'

const token: Finding = {
  id: 'a'.repeat(16),
  kind: 'token_pattern',
  path: 'config.ts',
  commit: 'c'.repeat(40),
  line: 3,
  excerpt: 'ghp_••••',
  reason: 'Jeton',
  blocking: false
}
const envFile: Finding = { ...token, id: 'b'.repeat(16), kind: 'file_name', path: '.env', blocking: true }

describe('règles du push et de gh (spec 021 T018, T019)', () => {
  it('should_build_only_whitelisted_gh_commands', () => {
    for (const args of [ghLoginArgs(), ghRepoViewArgs('compte/projet'), ghRepoCreateArgs('projet', 'private', 'x')]) {
      expect(() => assertSafeGhArgs(args)).not.toThrow()
    }
    for (const args of [
      ['auth', 'token'],
      ['pr', 'merge', '1'],
      ['pr', 'review', '1'],
      ['api', 'repos/compte/projet'],
      ['repo', 'create', 'x', '--private', '--source=.'],
      ['repo', 'create', 'x', '--push']
    ]) {
      expect(() => assertSafeGhArgs(args)).toThrow()
    }
    expect(() => ghRepoViewArgs('--json')).toThrow()
    expect(() => ghRepoCreateArgs('.cache', 'private', '')).toThrow()
    expect(ghRepoCreateArgs('projet', 'private', 'ligne 1\nligne 2')).toEqual([
      'repo',
      'create',
      'projet',
      '--private',
      '--description=ligne 1 ligne 2'
    ])
  })

  it('should_never_build_a_forced_or_multi_ref_push', () => {
    const push = pushArgs('origin', 'main', 'main', true)
    expect(push).toEqual(['push', '--porcelain', '--set-upstream', 'origin', 'refs/heads/main:refs/heads/main'])
    expect(() => assertSafeArgs(push)).not.toThrow()
    expect(() => assertSafeArgs(fetchArgs('origin'))).not.toThrow()
    for (const hostile of ['-f', '+main', ':main', '--force', 'a..b', 'x.lock']) {
      expect(() => safeRef(hostile)).toThrow()
    }
    expect(() => assertSafeArgs(['push', 'origin', '+main'])).toThrow()
  })

  it('should_block_sensitive_files_and_third_party_default_branches_but_allow_owners', () => {
    const github = (permission: 'admin' | 'maintain' | 'write' | 'read', owner = 'organisation') => ({
      permission,
      ownerLogin: owner,
      viewerLogin: 'moi',
      defaultBranch: 'main'
    })
    expect(pushVerdict({ findings: [envFile], github: github('admin'), targetBranch: 'main' }).blocked).toBe(
      'SENSITIVE_IN_HISTORY'
    )
    expect(pushVerdict({ findings: [], github: github('read'), targetBranch: 'essai' }).blocked).toBe('NO_WRITE_ACCESS')
    // D11 : dépôt d'autrui avec `write` seulement → branche principale refusée ; une autre branche passe.
    expect(pushVerdict({ findings: [], github: github('write'), targetBranch: 'main' }).blocked).toBe(
      'THIRD_PARTY_DEFAULT_BRANCH'
    )
    expect(pushVerdict({ findings: [], github: github('write'), targetBranch: 'ma-branche' }).blocked).toBeNull()
    // D11 : dépôt d'organisation avec `admin` ou `maintain`, ou dépôt à son compte → branche principale permise.
    for (const verdict of [
      pushVerdict({ findings: [], github: github('admin'), targetBranch: 'main' }),
      pushVerdict({ findings: [], github: github('maintain'), targetBranch: 'main' }),
      pushVerdict({ findings: [], github: github('write', 'MOI'), targetBranch: 'main' })
    ]) {
      expect(verdict).toMatchObject({ blocked: null, ownedByViewer: true, isDefaultBranch: true })
    }
    // Hors GitHub : permis (droits non vérifiés), un fichier sensible bloque toujours.
    expect(pushVerdict({ findings: [token], github: null, targetBranch: 'main' }).blocked).toBeNull()
    expect(pushVerdict({ findings: [envFile], github: null, targetBranch: 'main' }).blocked).toBe(
      'SENSITIVE_IN_HISTORY'
    )
  })

  it('should_accept_token_findings_one_by_one_but_never_a_blocking_one', () => {
    expect(unacceptedFindings([token], [])).toEqual([token])
    expect(unacceptedFindings([token], [token.id])).toEqual([])
    expect(unacceptedFindings([envFile], [envFile.id])).toEqual([envFile])
  })
})
