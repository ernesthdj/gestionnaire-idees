import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SkillInventory } from '../../../src/main/application/skills/SkillInventory'
import { writtenLinks } from '../../../src/main/domain/skills/links'

const SKILLS = 150
const text = (index: number): string =>
  `---\nname: skill-fictif-${index}\ndescription: Skill fictif numéro ${index}.\n---\n\n# Skill ${index}\n\n${'Étape fictive.\n'.repeat(80)}Lance /skill-fictif-${(index + 1) % SKILLS} ensuite.\n`

/**
 * SC-007 (spec 020 T033) : 150 skills. L'inventaire est vérifié sur le fond (150 nœuds, 150 liens) ; seul le calcul des
 * liens « appelle », pur, est chronométré : la durée des lectures disque dépend de l'antivirus sur des fichiers tout
 * juste écrits (mesures consignées dans `research.md`).
 */
describe('arbre de skills à l’échelle (spec 020 T033, SC-007)', () => {
  let root: string
  let home: string
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'skills-scale-'))
    home = join(root, 'home')
    for (let index = 0; index < SKILLS; index += 1) {
      const dir = join(home, '.claude', 'skills', `skill-fictif-${index}`)
      mkdirSync(join(dir, 'exemples'), { recursive: true })
      writeFileSync(join(dir, 'SKILL.md'), text(index))
      writeFileSync(join(dir, 'exemples', 'exemple.md'), 'Exemple fictif.\n')
    }
  })
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('should_inventory_150_skills_with_their_written_links', () => {
    const view = new SkillInventory({ home, projects: () => [] }).refresh()
    expect(view.skills).toHaveLength(SKILLS)
    expect(view.links).toHaveLength(SKILLS)
  })

  it('should_compute_written_links_of_150_skills_in_a_fraction_of_the_budget', () => {
    const sources = Array.from({ length: SKILLS }, (_, index) => ({
      id: `perso:skill-fictif-${index}`,
      name: `skill-fictif-${index}`,
      text: text(index)
    }))
    const started = performance.now()
    const links = writtenLinks(sources)
    const elapsed = performance.now() - started
    expect(links).toHaveLength(SKILLS)
    // Avant le pré-filtre : ~1,9 million d'essais d'expression régulière (~1 s) ; après : quelques dizaines de ms.
    expect(elapsed).toBeLessThan(300)
  })
})
