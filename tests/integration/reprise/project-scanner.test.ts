import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scanProject } from '../../../src/main/infrastructure/reprise/ProjectScanner'

describe('parcours d’un projet repris (spec 017 R4)', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'scan-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const file = (path: string, content = 'export const x = 1\n'): void => {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }

  it('should_skip_a_nested_worktree_or_repository_when_scanning', () => {
    file('src/a.ts')
    file('.kilo/worktrees/copie/.git', 'gitdir: ../../.git/worktrees/copie\n')
    file('.kilo/worktrees/copie/src/a.ts')
    file('vendored/lib/.git/HEAD', 'ref: refs/heads/main\n')
    file('vendored/lib/index.ts')
    const scan = scanProject(root)
    expect(scan.retained.map((entry) => entry.path)).toEqual(['src/a.ts'])
    expect(scan.ignored).toBeGreaterThanOrEqual(2)
  })
})
