import { describe, expect, it } from 'vitest'
import { parseSkillMarkdown } from '../../../src/shared/skills/frontMatter'

describe('en-tête des SKILL.md (spec 020 T004, research R2)', () => {
  it('should_read_name_description_and_trigger_when_the_header_is_simple', () => {
    const parsed = parseSkillMarkdown('---\nname: hub\ndescription: Ouvre les sessions\ntrigger: /hub\n---\n# Corps\n')
    expect(parsed.header).toEqual({ name: 'hub', description: 'Ouvre les sessions', trigger: '/hub' })
    expect(parsed.body).toBe('# Corps\n')
  })

  it('should_handle_quotes_and_escapes_when_values_are_quoted', () => {
    const parsed = parseSkillMarkdown('---\r\nname: "a"\r\ndescription: "Dit \\"bonjour\\" \\\\ et\\nplus"\r\n---\r\n')
    expect(parsed.header?.description).toBe('Dit "bonjour" \\ et\nplus')
    expect(parseSkillMarkdown("---\nname: b\ndescription: 'l''outil'\n---").header?.description).toBe("l'outil")
  })

  it('should_mark_the_skill_damaged_when_the_header_is_missing_or_incomplete', () => {
    expect(parseSkillMarkdown('# Pas d’en-tête').header).toBeNull()
    expect(parseSkillMarkdown('---\nname: a\n').header).toBeNull()
    expect(parseSkillMarkdown('---\nname: a\n---\n').header).toBeNull()
    expect(parseSkillMarkdown('---\nname: a\ndescription: "non fermée\n---').header).toBeNull()
  })

  it('should_ignore_unknown_keys_lists_anchors_and_tags_when_the_yaml_is_trapped', () => {
    const parsed = parseSkillMarkdown(
      [
        '---',
        'name: a',
        'description: &ancre texte # commentaire',
        'allowed-tools: !!python/object:os.system ["rm -rf /"]',
        'liste:',
        '  - name: piege',
        '---'
      ].join('\n')
    )
    expect(parsed.header).toEqual({ name: 'a', description: '&ancre texte' })
  })
})
