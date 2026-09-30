import { describe, expect, it } from 'vitest'
import { buildSynthesisInput, treeText } from '../../../src/main/application/neurons/SynthesisContextBuilder'
import type { GrowthNode } from '../../../src/main/infrastructure/db/repositories/GrowthRepository'

const node = (id: string, parentId: string | null, depth: number, patch: Partial<GrowthNode> = {}): GrowthNode => ({
  id,
  rootId: 'root',
  parentId,
  depth,
  kind: depth === 0 ? 'root' : 'answer',
  title: id,
  content: null,
  ...patch
})

/** Ordre de création : deux branches de premier niveau, puis leurs sous-branches créées plus tard, entremêlées. */
const NODES: GrowthNode[] = [
  node('root', null, 0, { title: 'Créer une app de brainstorming' }),
  node('budget', 'root', 1, { title: 'Budget : 300 €', question: 'Quel budget ?' }),
  node('stack', 'root', 1, { title: 'Stack : Electron' }),
  node('budget-detail', 'budget', 2, { title: 'Acompte de 100 €', content: 'Versé en octobre' }),
  node('stack-idea', 'stack', 2, { kind: 'idea', title: 'Prototyper le routage' }),
  node('budget-deep', 'budget-detail', 3, { title: 'Solde à la livraison' })
]

describe('arbre envoyé à Claude au verrouillage', () => {
  it('should_put_every_node_under_its_parent_whatever_the_creation_order', () => {
    expect(treeText(NODES).split('\n')).toEqual([
      '- [s0] (idée) Créer une app de brainstorming',
      '  - [s1] (réponse) Budget : 300 € (en réponse à : « Quel budget ? »)',
      '    - [s3] (réponse) Acompte de 100 € — Versé en octobre',
      '      - [s5] (réponse) Solde à la livraison',
      '  - [s2] (réponse) Stack : Electron',
      '    - [s4] (idée suggérée) Prototyper le routage'
    ])
  })

  it('should_keep_a_node_whose_parent_is_missing_instead_of_losing_it', () => {
    const text = treeText([...NODES, node('orphan', 'gone', 4, { title: 'Branche orpheline' })])
    expect(text).toContain('  - [s6] (réponse) Branche orpheline')
  })

  it('should_send_a_deep_tree_in_full_and_ask_for_every_branch', () => {
    const deep: GrowthNode[] = [
      node('root', null, 0),
      ...Array.from({ length: 150 }, (_, index) =>
        node(`n${index}`, index === 0 ? 'root' : `n${index - 1}`, Math.min(index + 1, 6), {
          title: `Réponse numéro ${index} avec assez de texte pour peser dans le contexte envoyé`
        })
      )
    ]
    const input = buildSynthesisInput({ nature: 'reflection', nodes: deep, missing: [], forced: false })
    expect(input).toContain('Réponse numéro 149')
    expect(input).toContain('Parcours TOUT l’arbre, branche par branche')
  })
})
