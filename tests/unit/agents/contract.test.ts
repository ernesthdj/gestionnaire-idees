import { describe, expect, it } from 'vitest'
import { contractInstructions, parseContract } from '../../../src/shared/agents/contract'

describe('contrat de l’Architecte (L2-pipeline-optimal D1, T006)', () => {
  it('should_read_zones_commands_and_questions_and_ignore_malformed_lines', () => {
    const lines = parseContract(
      [
        '## Décisions',
        'ZONE: back | src/main/api.ts, `src/shared/types.ts`',
        '- ZONE: front | src/renderer/',
        'ZONE: back | src/autre.ts',
        'ZONE: Intrus! | src/x.ts',
        'ZONE: vide |  ',
        'VERIFICATION: `npm test`',
        'VERIFICATION: npm run typecheck',
        'VERIFICATION: npm test',
        'QUESTION_PO: le tri est-il stable ?',
        'QUESTION_PO:   '
      ].join('\n')
    )
    // Une zone par agent (la première compte) ; un identifiant invalide ou une zone vide est ignoré.
    expect(lines.zones).toEqual([
      { agent: 'back', paths: ['src/main/api.ts', 'src/shared/types.ts'] },
      { agent: 'front', paths: ['src/renderer/'] }
    ])
    expect(lines.commands).toEqual(['npm test', 'npm run typecheck'])
    expect(lines.questions).toEqual(['le tri est-il stable ?'])
  })

  it('should_name_the_developers_and_the_app_lines_when_instructing_the_architect', () => {
    const text = contractInstructions([
      { id: 'po', role: 'po' },
      { id: 'archi', role: 'architecte' },
      { id: 'back', role: 'backend' },
      { id: 'qa', role: 'qa' }
    ])
    expect(text).toContain('ta réponse EST le contrat')
    expect(text).toContain('« ZONE: <agent> |')
    expect(text).toContain('(back)')
    expect(text).toContain('« VERIFICATION: <commande> »')
    expect(text).toContain('« QUESTION_PO: <question précise> »')
  })
})
