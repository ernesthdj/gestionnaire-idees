import { describe, expect, it } from 'vitest'
import { brainstormDocs, brainstormLevel, toBrainstorm } from '../../src/main/domain/workflow/brainstorm'

// Noms réels de docs/brainstorm/ (2026-10-09).
const entries = [
  'L1-fondation.md',
  'L1f-reprise-projet.md',
  'L1h-arbre-de-skills.md',
  'L1j-carte-workflow.md',
  'L2-reprise-import.md',
  'L2-skills-voir.md',
  'L2-capture-rapide.md',
  'L4d-reprise.md',
  'notes.md'
].map((name) => ({
  name,
  text: name === 'L1j-carte-workflow.md' ? '# L1j — La carte suit notre façon de travailler\n' : ''
}))

describe('brainstormDocs', () => {
  const docs = brainstormDocs(entries, [
    { number: '017', citedDocs: ['L1f-reprise-projet.md', 'L4d-reprise.md'] },
    { number: '020', citedDocs: ['L1h-arbre-de-skills.md'] }
  ])
  const byName = (name: string) => docs.find((doc) => doc.name === name)

  it('should_attach_each_lower_level_doc_to_its_family_when_a_level_one_shares_its_first_word', () => {
    expect(byName('L2-reprise-import.md')?.family).toBe('L1f-reprise-projet.md')
    expect(byName('L2-skills-voir.md')?.family).toBe('L1h-arbre-de-skills.md')
    expect(byName('L4d-reprise.md')?.family).toBe('L1f-reprise-projet.md')
    expect(byName('L2-capture-rapide.md')?.family).toBeNull()
  })

  it('should_read_level_title_and_covering_specs_and_skip_other_files_when_listing_docs', () => {
    expect(byName('notes.md')).toBeUndefined()
    expect(byName('L1j-carte-workflow.md')).toMatchObject({
      level: 1,
      title: 'L1j — La carte suit notre façon de travailler'
    })
    expect(byName('L1f-reprise-projet.md')?.coveredBy).toEqual(['017'])
    expect(byName('L2-skills-voir.md')?.title).toBe('L2-skills-voir.md')
  })

  it('should_keep_only_uncited_level_one_docs_except_the_foundation_when_listing_ideas_to_brainstorm', () => {
    expect(toBrainstorm(docs).map((doc) => doc.name)).toEqual(['L1j-carte-workflow.md'])
  })
})

describe('brainstormLevel', () => {
  it('should_return_the_level_or_null_when_the_name_is_not_a_brainstorm_doc', () => {
    expect(brainstormLevel('L3-git-publier.md')).toBe(3)
    expect(brainstormLevel('README.md')).toBeNull()
  })
})
