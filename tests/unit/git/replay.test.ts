import { describe, expect, it } from 'vitest'
import { fileToNode, type NodeTree } from '../../../src/main/domain/git/fileToNode'
import { parseReplayLog, replayNodes } from '../../../src/main/domain/git/replay'

const tree = (entries: readonly (readonly [string, string])[]): NodeTree => {
  const parents = new Map(entries)
  return { has: (key) => parents.has(key), parent: (key) => parents.get(key) ?? null }
}
const TREE = tree([
  ['m:web', ''],
  ['d:web/src', 'm:web'],
  ['d:web/src/ui', 'd:web/src'],
  ['f:web/src/ui/Bouton.tsx', 'd:web/src/ui'],
  ['f:web/src/main.ts', 'd:web/src'],
  ['f:web/index.html', 'm:web']
])

describe('fichier → nœud visible de l’explorateur (spec 021 T030)', () => {
  it('should_climb_to_the_first_visible_node', () => {
    expect(fileToNode('web/src/ui/Bouton.tsx', new Set(['m:web']), TREE)).toBe('m:web')
    expect(fileToNode('web/src/ui/Bouton.tsx', new Set(['d:web/src/ui', 'd:web/src']), TREE)).toBe('d:web/src/ui')
    expect(fileToNode('web\\src\\main.ts', new Set(['d:web/src']), TREE)).toBe('d:web/src')
  })

  it('should_send_a_file_lying_in_the_opened_node_to_its_racine_node', () => {
    expect(fileToNode('web/index.html', new Set(['d:web/src', 'r:m:web']), TREE)).toBe('r:m:web')
    expect(fileToNode('web/src/main.ts', new Set(['d:web/src/ui', 'r:d:web/src']), TREE)).toBe('r:d:web/src')
  })

  it('should_place_a_deleted_file_by_its_deepest_known_folder_and_ignore_unknown_paths', () => {
    expect(fileToNode('web/src/ui/Ancien.tsx', new Set(['d:web/src/ui']), TREE)).toBe('d:web/src/ui')
    expect(fileToNode('docs/README.md', new Set(['m:web']), TREE)).toBeNull()
    expect(fileToNode('web/src/main.ts', new Set(['m:autre']), TREE)).toBeNull()
  })
})

describe('rediffusion : journal et agrégation (spec 021 US5 lot 2)', () => {
  const H1 = 'a'.repeat(40)
  const H2 = 'b'.repeat(40)
  const output =
    `\x1e${H1}\x1fAlice Fictive\x1falice@example.invalid\x1f2026-10-01T10:00:00+02:00\0` +
    `\n3\t1\tweb/src/main.ts\0-\t-\tweb/logo.png\0` +
    `\x1e${H2}\x1fBob Fictif\x1fbob@example.invalid\x1f2026-10-02T10:00:00+02:00\0\nweb/src/ui/Bouton.tsx\0`

  it('should_read_numstat_lines_names_only_and_binaries', () => {
    const commits = parseReplayLog(output)
    expect(commits.map((commit) => commit.hash)).toEqual([H1, H2])
    expect(commits[0]).toMatchObject({ name: 'Alice Fictive', email: 'alice@example.invalid' })
    expect(commits[0]?.changes).toEqual([
      { path: 'web/src/main.ts', weight: 4 },
      { path: 'web/logo.png', weight: 1 }
    ])
    expect(commits[1]?.changes).toEqual([{ path: 'web/src/ui/Bouton.tsx', weight: 1 }])
    expect(parseReplayLog('pas un journal')).toEqual([])
  })

  it('should_aggregate_main_last_and_shares_by_lines_or_by_commits', () => {
    const steps = [
      { authorKey: 'alice', changes: [{ path: 'a', weight: 9 }] },
      {
        authorKey: 'bob',
        changes: [
          { path: 'a', weight: 1 },
          { path: 'b', weight: 2 }
        ]
      },
      { authorKey: 'bob', changes: [{ path: 'x', weight: 50 }] }
    ]
    const owner = (path: string): string | null => (path === 'x' ? null : 'n')
    expect(replayNodes(steps, 1, owner, 'lines')).toEqual([
      {
        key: 'n',
        main: 'alice',
        last: 'bob',
        shares: [
          { authorKey: 'alice', percent: 75 },
          { authorKey: 'bob', percent: 25 }
        ]
      }
    ])
    // Par commits : un commit compte 1 par nœud, quel que soit le nombre de fichiers ; ici égalité (le premier gagne).
    expect(replayNodes(steps, 2, owner, 'commits')[0]?.shares).toEqual([
      { authorKey: 'alice', percent: 50 },
      { authorKey: 'bob', percent: 50 }
    ])
    expect(replayNodes(steps, 0, owner, 'lines')[0]).toMatchObject({ main: 'alice', last: 'alice' })
  })
})
