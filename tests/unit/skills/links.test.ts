import { describe, expect, it } from 'vitest'
import { writtenLinks } from '../../../src/main/domain/skills/links'

const skill = (id: string, name: string, text: string) => ({ id, name, text })

describe('liens écrits entre skills (spec 020 T007)', () => {
  it('should_link_a_skill_to_the_commands_and_skills_it_mentions', () => {
    const links = writtenLinks([
      skill('perso:hub', 'hub', 'Ligne 1\nLance `/graphify .` puis le skill professor.'),
      skill('perso:graphify', 'graphify', 'rien'),
      skill('perso:professor', 'professor', 'rien')
    ])
    expect(links).toEqual([
      { from: 'perso:hub', to: 'perso:graphify', kind: 'appelle', line: 2 },
      { from: 'perso:hub', to: 'perso:professor', kind: 'appelle', line: 2 }
    ])
  })

  it('should_ignore_urls_paths_self_links_short_names_and_partial_words', () => {
    const links = writtenLinks([
      skill('perso:hub', 'hub', 'Voir https://example.invalid/journal et src/journal, /hub, /journaliste, skill ab'),
      skill('projet:g:journal', 'journal', 'rien'),
      skill('perso:ab', 'ab', 'rien'),
      skill('plugin:m/p:hub', 'hub', 'rien')
    ])
    expect(links).toEqual([])
  })

  it('should_find_a_mention_case_insensitively_with_backticks', () => {
    const links = writtenLinks([skill('a:x', 'xyz', 'Utilise le Skill `journal`.'), skill('b:j', 'journal', '')])
    expect(links).toEqual([{ from: 'a:x', to: 'b:j', kind: 'appelle', line: 1 }])
  })
})
