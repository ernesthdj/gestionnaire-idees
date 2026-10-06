import { describe, expect, it } from 'vitest'
import {
  cleanText,
  isCodeType,
  registryWithBranch,
  registryWithProject,
  RegistryError,
  scaffoldFiles,
  slugify,
  slugProblem
} from '../../../src/main/domain/projects/project'

const identity = {
  name: 'Studio photo',
  slug: 'studio-photo',
  type: 'Web App' as const,
  description: 'Un studio à Liège',
  date: '2026-10-06',
  dateTime: '2026-10-06 15:00'
}

describe('genesis → projet : règles pures (spec 016)', () => {
  it('should_propose_a_folder_name_without_accents_or_symbols_when_given_a_title', () => {
    expect(slugify('Ouvrir un Studio Photo à Liège !')).toBe('ouvrir-un-studio-photo-a-liege')
    expect(slugify('  --Déjà vu--  ')).toBe('deja-vu')
    expect(slugify('a'.repeat(60))).toHaveLength(50)
    expect(slugify('x'.repeat(49) + ' yy').endsWith('-')).toBe(false)
  })

  it('should_refuse_invalid_or_reserved_folder_names', () => {
    expect(slugProblem('studio-photo')).toBeNull()
    expect(slugProblem('a')).not.toBeNull()
    expect(slugProblem('Studio')).not.toBeNull()
    expect(slugProblem('-studio')).not.toBeNull()
    expect(slugProblem('studio--photo')).not.toBeNull()
    expect(slugProblem('..')).not.toBeNull()
    expect(slugProblem('a/b')).not.toBeNull()
    expect(slugProblem('status')).toMatch(/réservé/)
  })

  it('should_strip_quotes_and_line_breaks_that_would_break_the_launcher', () => {
    expect(cleanText('Un "studio"\nà Liège\\Namur', 100)).toBe('Un ’studio’ à Liège/Namur')
    expect(cleanText('abcdef', 4)).toBe('abc…')
  })

  it('should_give_code_projects_src_and_tests_but_not_a_knowledge_base', () => {
    const code = scaffoldFiles(identity)
    expect(code.files.map((file) => file.path)).toEqual(['CLAUDE.md', 'README.md', 'docs/JOURNAL.md'])
    expect(code.dirs).toEqual(['src', 'tests'])
    expect(code.files[0]?.content).toContain('> **Slug :** studio-photo')
    expect(isCodeType('Knowledge Base')).toBe(false)
    expect(scaffoldFiles({ ...identity, type: 'Knowledge Base' }).dirs).toEqual([])
  })

  it('should_add_the_project_to_the_registry_and_keep_the_others', () => {
    const registry = { version: '1.0', projects: { autre: { slug: 'autre', folder: 'Autre' } } }
    const next = registryWithProject(registry, {
      ...identity,
      folder: 'studio-photo',
      createdAt: '2026-10-06T13:00:00Z'
    })
    expect(next['version']).toBe('1.0')
    expect(next['projects']).toMatchObject({
      autre: { slug: 'autre', folder: 'Autre' },
      'studio-photo': {
        slug: 'studio-photo',
        name: 'Studio photo',
        status: 'active',
        branch: null,
        folder: 'studio-photo'
      }
    })
  })

  it('should_refuse_an_existing_slug_or_an_unreadable_registry', () => {
    const entry = { ...identity, folder: 'studio-photo', createdAt: '' }
    expect(() => registryWithProject({ projects: { 'studio-photo': {} } }, entry)).toThrow(RegistryError)
    expect(() => registryWithProject({ version: '1.0' }, entry)).toThrow(RegistryError)
    expect(() => registryWithProject([], entry)).toThrow(RegistryError)
  })

  it('should_set_the_branch_only_when_the_project_is_registered', () => {
    const registry = { projects: { 'studio-photo': { slug: 'studio-photo', branch: null } } }
    expect(registryWithBranch(registry, 'studio-photo', 'main')?.['projects']).toEqual({
      'studio-photo': { slug: 'studio-photo', branch: 'main' }
    })
    expect(registryWithBranch(registry, 'absent', 'main')).toBeNull()
  })
})
