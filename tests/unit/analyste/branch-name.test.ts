import { describe, expect, it } from 'vitest'
import { branchName, id8, isAnalystBranch, slugOf, worktreeRelPath } from '../../../src/main/domain/analyste/branchName'

const ID = '4B1F0C1E-9a4b-4c3d-8e2f-0a1b2c3d4e5f'

describe('nom de branche d’une mise à jour (spec 019 T030)', () => {
  it('should_build_a_safe_branch_and_worktree_from_the_id_and_title', () => {
    expect(id8(ID)).toBe('4b1f0c1e')
    expect(branchName(ID, 'Remplacer « categoriser » par une règle fixe')).toBe(
      'analyste/4b1f0c1e-remplacer-categoriser-par-une'
    )
    expect(worktreeRelPath(ID)).toBe('.analyste/worktrees/4b1f0c1e')
    expect(isAnalystBranch(branchName(ID, 'Titre'))).toBe(true)
  })

  it('should_neutralise_hostile_titles', () => {
    expect(slugOf('../../main --force ; rm -rf /')).toBe('main-force-rm-rf')
    expect(slugOf('Éléments à côté')).toBe('elements-a-cote')
    expect(slugOf('!!!')).toBe('proposition')
    expect(slugOf('a'.repeat(80))).toHaveLength(30)
    expect(() => id8('pas-un-id')).toThrow()
  })

  it('should_recognise_only_analyst_branches', () => {
    for (const name of ['main', 'analyste/../main', 'analyste/4b1f0c1e', 'analyste/zzzzzzzz-x', 'feature/analyste'])
      expect(isAnalystBranch(name)).toBe(false)
  })
})
