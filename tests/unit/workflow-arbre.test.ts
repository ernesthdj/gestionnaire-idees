import { describe, expect, it } from 'vitest'
import type { WorkflowTreeNode, WorkflowTreeView } from '../../src/shared/ipc/workflow'
import { brainstormDocs } from '../../src/main/domain/workflow/brainstorm'
import { docHeader } from '../../src/main/domain/workflow/docHeader'
import { parseSpec } from '../../src/main/domain/workflow/parseSpec'
import { parseTaskFile } from '../../src/main/domain/workflow/parseTaskFile'
import { parseTasks } from '../../src/main/domain/workflow/parseTasks'
import { buildSpec } from '../../src/main/domain/workflow/specStatus'
import { TREE_DEPTH, workflowArbre } from '../../src/shared/workflow/arbre'

/** Un petit projet fictif écrit comme Claude l'écrit (spec 032 D9, D10). */
const DOCS: Record<string, string> = {
  'L1-fondation.md': '# Fondation\n\n**Maturité** : complet\n',
  'L1a-donnees.md': '# Données\n\n**Maturité** : complet\n',
  'L2-donnees-sauvegarde.md':
    '# Sauvegarde\n\n**Parent** : L1a-donnees.md · **Maturité** : complet · **Tâches** : docs/TACHES-SAUVEGARDE.md\n',
  'L1b-recherche.md': '# Recherche\n\n**Maturité** : suffisant · **Tâches** : docs/TACHES-RECHERCHE.md\n',
  'L1c-synchro.md': '# Synchro\n\n**Parent** : L1-fondation.md\n',
  'L2-capture.md': '# Capture\n\n**Parent** : L1-fondation.md · **Maturité** : complet\n'
}
const SPEC = `# Feature Specification: Application (spec 004)

**Feature Branch**: \`main\` · **Status**: En cours
Origine : docs/brainstorm/L1a-donnees.md

### User Story 1 — Écran principal (Priority: P1)
`
const TASKS = `- [x] T001 Mise en place
- [~] T002 [US1] Liste des notes
- [ ] T003 [US1] Éditeur
`
const DELIVERED = `# Feature Specification: Ancienne (spec 001)

**Status**: Livrée (2026-10-01)
`
const TACHES_SAUVEGARDE = `# Tâches — Sauvegarde

## Lot 1 — Planification
- [x] T001 Tâche quotidienne
- [ ] T002 Rappel si échec
`
const TACHES_RECHERCHE = `# Tâches — Recherche

- [ ] T001 Index
- [ ] T002 Filtres
`
const TACHES_SEUL = `# Tâches — Agents

- [ ] T001 Profils
`

function build(docs: Record<string, string> = DOCS, specTasks = TASKS): WorkflowTreeView {
  const specs = [
    buildSpec({
      dir: 'specs/001-ancienne',
      spec: parseSpec(DELIVERED),
      tasks: parseTasks('- [ ] T009 Reliquat\n').tasks,
      partial: false
    }),
    buildSpec({
      dir: 'specs/004-application',
      spec: parseSpec(SPEC),
      tasks: parseTasks(specTasks).tasks,
      partial: false
    })
  ]
  const brainstorm = brainstormDocs(
    Object.entries(docs).map(([name, text]) => ({ name, text })),
    specs
  )
  const files = [
    parseTaskFile('docs/TACHES-AGENTS.md', TACHES_SEUL),
    parseTaskFile('docs/TACHES-RECHERCHE.md', TACHES_RECHERCHE),
    parseTaskFile('docs/TACHES-SAUVEGARDE.md', TACHES_SAUVEGARDE)
  ]
  return workflowArbre(brainstorm, specs, files)
}

const find = (nodes: readonly WorkflowTreeNode[], key: string): WorkflowTreeNode | undefined => {
  for (const node of nodes) {
    if (node.key === key) return node
    const inner = find(node.children, key)
    if (inner !== undefined) return inner
  }
  return undefined
}
const titles = (nodes: readonly WorkflowTreeNode[]): string[] => nodes.map((node) => node.title)

describe('en-tête d’un document de brainstorm (spec 032 FR-002)', () => {
  it('should_read_parent_maturity_and_task_files_from_the_header_line', () => {
    expect(
      docHeader(
        '# Titre\n\n**Parent** : L1f-reprise-projet.md · **Maturité** : insuffisant — manque : X · **Tâches** : docs/TACHES-A.md, TACHES-B.md\n'
      )
    ).toEqual({
      parent: 'L1f-reprise-projet.md',
      maturity: 'insuffisant',
      taskPaths: ['docs/TACHES-A.md', 'TACHES-B.md']
    })
  })

  it('should_ignore_unknown_values_paths_outside_the_project_and_fields_in_the_body', () => {
    expect(
      docHeader('# T\n\n**Parent** : ../secret.md · **Maturité** : génial · **Tâches** : ../../x.md, C:/y.md\n')
    ).toEqual({
      parent: null,
      maturity: null,
      taskPaths: []
    })
    const body = `# T\n${'\nligne'.repeat(20)}\n**Maturité** : complet\n`
    expect(docHeader(body).maturity).toBeNull()
    expect(docHeader('sans titre ni champ')).toEqual({ parent: null, maturity: null, taskPaths: [] })
  })
})

describe('arbre du Workflow (spec 032 D9, D10, D5, D6)', () => {
  it('should_put_rounds_under_their_parent_and_the_project_children_at_level_one', () => {
    const tree = build()
    // Documents d'abord (par nom), puis specs et fichiers de tâches sans rond ; la fondation est le projet.
    expect(titles(tree.nodes)).toEqual(['Données', 'Recherche', 'Synchro', 'Capture', 'Ancienne', 'Tâches — Agents'])
    const donnees = find(tree.nodes, 'doc:L1a-donnees')
    // Sous Données : son sous-document, puis la spec qui le cite.
    expect(titles(donnees?.children ?? [])).toEqual(['Sauvegarde', 'Application'])
    expect(titles(find(tree.nodes, 'doc:L2-donnees-sauvegarde')?.children ?? [])).toEqual(['Tâches — Sauvegarde'])
    expect(tree.project).toMatchObject({ maturity: 100 })
  })

  it('should_turn_maturity_into_a_ring_and_a_written_spec_into_a_complete_round', () => {
    const tree = build()
    expect(find(tree.nodes, 'doc:L1b-recherche')?.maturity).toBe(66)
    expect(find(tree.nodes, 'doc:L1c-synchro')?.maturity).toBeNull()
    expect(find(tree.nodes, 'spec:004')).toMatchObject({ kind: 'round', maturity: 100, done: 1, total: 3 })
    expect(find(tree.nodes, 'story:004:1')).toMatchObject({ kind: 'round', done: 0, total: 2 })
  })

  it('should_show_the_tasks_of_an_unfinished_brainstorm_as_sketches_never_to_implement', () => {
    const tree = build()
    const recherche = find(tree.nodes, 'doc:L1b-recherche')
    const squares = find(recherche?.children ?? [], recherche?.children[0]?.key ?? '')?.children ?? []
    expect(squares.map((node) => [node.title, node.kind, node.sketch])).toEqual([
      ['Index', 'square', true],
      ['Filtres', 'square', true]
    ])
    // Un fichier de tâches sans rond est un plan écrit : ses carrés ne sont pas des ébauches.
    expect(
      find(tree.nodes, 'file:' + parseTaskFile('docs/TACHES-AGENTS.md', TACHES_SEUL).key)?.children[0]?.sketch
    ).toBe(false)
  })

  it('should_pick_the_square_in_progress_first_then_the_first_to_do_and_skip_delivered_specs', () => {
    expect(find(build().nodes, build().next ?? '')?.title).toBe('Liste des notes')
    const noneDoing = build(DOCS, TASKS.replace('- [~] T002', '- [x] T002'))
    // Rien en cours : le premier carré à faire dans l'ordre de l'arbre (Données › Sauvegarde passe avant la spec).
    expect(find(noneDoing.nodes, noneDoing.next ?? '')?.title).toBe('Rappel si échec')
    // Le reliquat d'une spec livrée est un carré, jamais « à bosser » (Q2 : rond complet, carrés faits ou non).
    expect(find(noneDoing.nodes, 'task:001:T009')).toMatchObject({ kind: 'square', state: 'todo', sketch: false })
  })

  it('should_put_a_spec_under_its_written_parent_before_the_documents_it_only_cites', () => {
    const spec = parseSpec(
      '# Vues (spec 032)\n\n**Parent** : L1b-recherche.md · **Status**: Écrite\nExemple : L1a-donnees.md\n'
    )
    expect(spec.parentDoc).toBe('L1b-recherche.md')
    const view = buildSpec({ dir: 'specs/032-vues', spec, tasks: null, partial: false })
    const docs = brainstormDocs(
      Object.entries(DOCS).map(([name, text]) => ({ name, text })),
      [view]
    )
    const tree = workflowArbre(docs, [view], [])
    expect(find(tree.nodes, 'doc:L1b-recherche')?.children.map((node) => node.key)).toEqual(['spec:032'])
  })

  it('should_give_the_same_tree_for_the_same_files', () => {
    expect(build()).toEqual(build())
  })

  it('should_lift_a_document_in_a_parent_loop_or_with_a_missing_parent_to_level_one', () => {
    const tree = build({
      'L1a-donnees.md': '# A\n\n**Parent** : L2-b.md\n',
      'L2-b.md': '# B\n\n**Parent** : L1a-donnees.md\n',
      'L2-orphelin.md': '# Orphelin\n\n**Parent** : L1z-absent.md\n'
    })
    expect(titles(tree.nodes).slice(0, 3)).toEqual(['A', 'B', 'Orphelin'])
  })

  it('should_keep_at_most_four_levels_and_flatten_the_squares_below', () => {
    const chain: Record<string, string> = { 'L1a-n1.md': '# N1\n\n**Maturité** : complet\n' }
    for (let level = 2; level <= 6; level++) {
      chain[`L${Math.min(level, 4)}${'abcdef'[level - 1]}-n${level}.md`] =
        `# N${level}\n\n**Parent** : ${Object.keys(chain).at(-1)} · **Maturité** : complet${level === 6 ? ' · **Tâches** : docs/TACHES-AGENTS.md' : ''}\n`
    }
    const tree = build(chain)
    let node = find(tree.nodes, 'doc:L1a-n1')
    for (let depth = 2; depth <= TREE_DEPTH; depth++) node = node?.children.find((child) => child.kind === 'round')
    expect(node?.title).toBe('N4')
    // Au dernier niveau : plus de rond, la case du fichier de tâches nommé tout en bas remonte.
    expect(node?.children.map((child) => [child.kind, child.title])).toEqual([['square', 'Profils']])
  })
})
