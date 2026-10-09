import { describe, expect, it } from 'vitest'
import { contentFindings, fileNameFinding, isSensitivePath } from '../../../src/main/domain/git/sensitive'
import { FAKE_PRIVATE_KEY, FAKE_TOKEN } from '../../support/gitRepos'

describe('fichiers et contenus sensibles (spec 021 T006, SC-003)', () => {
  it('should_flag_every_secret_file_name_of_the_fake_set_and_spare_templates', () => {
    for (const path of [
      '.env',
      'config/.env.local',
      'cle.pem',
      'id_rsa',
      'deploy/server.key',
      'appsettings.Production.json'
    ]) {
      expect(isSensitivePath(path), path).toBe(true)
      expect(fileNameFinding(path, 'a1b2c3d')).toMatchObject({ kind: 'file_name', blocking: true })
    }
    for (const path of ['.env.example', 'src/env.ts', 'README.md', 'docs/keys.md']) {
      expect(isSensitivePath(path), path).toBe(false)
    }
  })

  it('should_block_a_private_key_and_only_report_a_token_with_a_masked_excerpt', () => {
    const key = contentFindings('cle.pem', 'a1b2c3d', FAKE_PRIVATE_KEY)
    expect(key).toHaveLength(1)
    expect(key[0]).toMatchObject({ kind: 'private_key', blocking: true, line: 1 })
    const token = contentFindings('tests/jeton.test.ts', 'b2c3d4e', `const jeton = '${FAKE_TOKEN}'`)
    expect(token).toHaveLength(1)
    expect(token[0]).toMatchObject({ kind: 'token_pattern', blocking: false })
    expect(token[0]?.excerpt).not.toContain(FAKE_TOKEN)
    expect(token[0]?.excerpt).toContain('•')
  })

  it('should_give_stable_ids_and_nothing_for_ordinary_code', () => {
    const once = contentFindings('a.ts', 'c', `x = '${FAKE_TOKEN}'`)
    const twice = contentFindings('a.ts', 'c', `x = '${FAKE_TOKEN}'`)
    expect(once[0]?.id).toBe(twice[0]?.id)
    expect(contentFindings('a.ts', 'c', 'const skip = true\nconst ghost = "gh"\n')).toEqual([])
  })
})
