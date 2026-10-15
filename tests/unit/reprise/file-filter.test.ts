import { describe, expect, it } from 'vitest'
import {
  ANALYZED_FILE_MAX_BYTES,
  classifyFile,
  gitignoreMatcher,
  isExcludedDir,
  langOf
} from '../../../src/main/domain/reprise/fileFilter'

const none = (): boolean => false

describe('fichiers retenus, sensibles ou ignorés d’un projet repris (spec 017 FR-013)', () => {
  it.each([
    ['.env', 'sensitive'],
    ['config/.env.production', 'sensitive'],
    ['certs/server.pem', 'sensitive'],
    ['config/appsettings.Production.json', 'sensitive'],
    ['Web.config', 'sensitive'],
    ['.env.example', 'retained'],
    ['appsettings.json', 'retained'],
    ['node_modules/x/index.js', 'ignored'],
    ['src/bin/tool.cs', 'ignored'],
    ['vendor/laravel/x.php', 'ignored'],
    ['assets/logo.png', 'ignored'],
    ['src/app.ts', 'retained']
  ])('should_classify_%s_as_%s', (path, kind) => {
    expect(classifyFile(path, 100, none).kind).toBe(kind)
  })

  it.each([
    ['graphify-out/graph.json', 'ignored'],
    ['.claude/skills/journal/SKILL.md', 'ignored'],
    ['.specify/memory/constitution.md', 'ignored'],
    ['CLAUDE.md', 'ignored'],
    ['packages/api/AGENTS.md', 'ignored'],
    ['docs/claude/regles-dev.md', 'ignored'],
    ['docs/JOURNAL.md', 'ignored'],
    ['README.md', 'retained'],
    ['docs/FOUNDATION.md', 'retained'],
    ['specs/032-trois-vues/spec.md', 'retained'],
    ['src/journal/JOURNAL.md', 'retained']
  ])('should_ignore_ai_only_tooling_and_docs_but_keep_informative_docs_%s_%s', (path, kind) => {
    expect(classifyFile(path, 100, none).kind).toBe(kind)
  })

  it('should_never_walk_ai_only_folders_by_name_or_by_path', () => {
    expect(['graphify-out', 'src/.claude', 'docs/claude', 'Docs/Claude'].map(isExcludedDir)).toEqual([
      true,
      true,
      true,
      true
    ])
    expect(['docs', 'src/claude', 'specs'].map(isExcludedDir)).toEqual([false, false, false])
  })

  it('should_flag_a_file_too_large_and_never_read_a_sensitive_one_whatever_its_size', () => {
    expect(classifyFile('src/big.ts', ANALYZED_FILE_MAX_BYTES + 1, none).kind).toBe('too_large')
    expect(classifyFile('.env', ANALYZED_FILE_MAX_BYTES + 1, none).kind).toBe('sensitive')
  })

  it('should_tell_the_language_from_the_extension', () => {
    expect(['a.ts', 'b.tsx', 'c.mjs', 'D.CS', 'e.php', 'f.py', 'Makefile'].map(langOf)).toEqual([
      'ts',
      'tsx',
      'js',
      'cs',
      'php',
      'other',
      'other'
    ])
  })

  it('should_follow_simple_gitignore_patterns_and_ignore_negations', () => {
    const ignored = gitignoreMatcher(
      ['# commentaire', 'logs/', '*.log', '/generated', 'docs/**/draft.md', '!important.log', ''].join('\n')
    )
    expect(ignored('logs/app.txt')).toBe(true)
    expect(ignored('src/logs/app.txt')).toBe(true)
    expect(ignored('src/server.log')).toBe(true)
    expect(ignored('important.log')).toBe(true)
    expect(ignored('generated/x.ts')).toBe(true)
    expect(ignored('src/generated/x.ts')).toBe(false)
    expect(ignored('docs/a/b/draft.md')).toBe(true)
    expect(ignored('src/app.ts')).toBe(false)
    expect(ignored('logs')).toBe(false)
    expect(ignored('logs', true)).toBe(true)
    expect(ignored('src/logs', true)).toBe(true)
  })
})
