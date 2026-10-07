import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsInRepo, graphGenesisFor } from '../../../src/main/application/analyste/repoCode'

describe('fichiers et graphe du dépôt de l’Analyste (spec 019 T021, research R4)', () => {
  let root: string
  let repo: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gi-analyste-repo-'))
    repo = join(root, 'brainstormer')
    mkdirSync(join(repo, 'src'), { recursive: true })
    writeFileSync(join(repo, 'src', 'a.ts'), '')
    mkdirSync(join(root, 'dehors'))
    writeFileSync(join(root, 'dehors', 'secret.txt'), '')
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should_accept_an_existing_file_or_folder_inside_the_repository', () => {
    expect(existsInRepo(repo, 'src/a.ts')).toBe(true)
    expect(existsInRepo(repo, 'src')).toBe(true)
    expect(existsInRepo(repo, 'src/b.ts')).toBe(false)
  })

  it('should_refuse_a_link_that_leads_outside_the_repository', () => {
    // Jonction Windows (pas de droits administrateur) : le chemin réel est hors du dépôt.
    symlinkSync(join(root, 'dehors'), join(repo, 'lien'), 'junction')
    expect(existsInRepo(repo, 'lien/secret.txt')).toBe(false)
  })

  it('should_prefer_a_genesis_already_linked_to_the_repository_then_a_resumed_project', () => {
    const hasGraph = (id: string): boolean => id !== 'vide'
    expect(
      graphGenesisFor(repo, {
        linkedFolders: () => [
          { id: 'autre', projectDir: join(root, 'dehors') },
          { id: 'lie', projectDir: `${repo}\\` }
        ],
        projectByRoot: () => ({ genesisId: 'repris' }),
        hasGraph
      })
    ).toBe('lie')
    expect(
      graphGenesisFor(repo, {
        linkedFolders: () => [{ id: 'vide', projectDir: repo }],
        projectByRoot: () => ({ genesisId: 'repris' }),
        hasGraph
      })
    ).toBe('repris')
    expect(graphGenesisFor(repo, { linkedFolders: () => [], projectByRoot: () => undefined, hasGraph })).toBeNull()
  })
})
