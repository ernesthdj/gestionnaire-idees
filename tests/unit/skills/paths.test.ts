import { describe, expect, it } from 'vitest'
import { compareVersions, isExecutablePath, isSkillName, safeRelativePath } from '../../../src/main/domain/skills/paths'

describe('noms et chemins des skills (spec 020 T005)', () => {
  it('should_accept_only_lowercase_folder_names_when_checking_a_skill_name', () => {
    expect(['hub', 'speckit-plan', 'a1'].every(isSkillName)).toBe(true)
    expect(['', 'Hub', '-x', 'a_b', 'a/b', 'a'.repeat(65), '..'].some(isSkillName)).toBe(false)
  })

  it('should_refuse_hostile_relative_paths', () => {
    for (const bad of ['', '/etc/passwd', 'C:/x', 'c:x', '..\\x', 'a/../b', './a', 'a//b', 'a\\b', 'a\u0000b', 'a/'])
      expect(safeRelativePath(bad)).toBeNull()
    expect(safeRelativePath('scripts/run.sh')).toBe('scripts/run.sh')
  })

  it('should_flag_executable_extensions_whatever_the_case', () => {
    expect(['run.sh', 'a/B.PS1', 'x.mjs', 'tool.exe'].every(isExecutablePath)).toBe(true)
    expect(['SKILL.md', 'notes.txt', '.sh', 'data.json'].some(isExecutablePath)).toBe(false)
  })

  it('should_order_plugin_versions_semver_first_then_lexically', () => {
    expect(['1.10.0', '1.2.0', 'latest', '1.9.3'].sort(compareVersions)).toEqual(['latest', '1.2.0', '1.9.3', '1.10.0'])
  })
})
