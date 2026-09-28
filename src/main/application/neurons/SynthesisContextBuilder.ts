import type { NeuronKind, Nature } from '@shared/ipc/neurons'
import { aliasesOf } from '../../domain/neurons/tree'
import type { GrowthNode } from '../../infrastructure/db/repositories/GrowthRepository'

/** Même borne que la croissance (≈ 3 000 tokens d'arbre). */
const MAX_INPUT_CHARS = 12_000
const OUTLINE_MAX_CHARS = 2_000

const KIND_LABELS: Readonly<Record<NeuronKind, string>> = {
  root: 'idée',
  answer: 'réponse',
  condition: 'condition',
  branch: 'branche',
  opportunity: 'opportunité',
  investigation: 'à trouver',
  user_branch: 'piste ajoutée'
}

function line(node: GrowthNode, alias: string): string {
  const detail = node.content !== null && node.content !== node.title ? ` — ${node.content}` : ''
  return `${'  '.repeat(node.depth)}- [${alias}] (${KIND_LABELS[node.kind]}) ${node.title}${detail}`
}

/** Arbre complet indenté, chaque nœud précédé de son alias (`sourceRefs`). */
function treeText(nodes: readonly GrowthNode[]): string {
  const alias = aliasesOf(nodes)
  return nodes.map((node) => line(node, alias.get(node.id) ?? '?')).join('\n')
}

/** Texte d'un sous-neurone tel qu'écrit par l'utilisateur, par alias (contrôle de provenance P6). */
export function sourceTexts(nodes: readonly GrowthNode[]): Map<string, string> {
  const alias = aliasesOf(nodes)
  return new Map(nodes.map((node) => [alias.get(node.id) ?? '?', [node.title, node.content ?? ''].join('\n')]))
}

/** Plan de l'arbre en titres seuls, borné : entrée compacte des exemples appris (ExampleStore). */
export function outline(nodes: readonly GrowthNode[]): string {
  return nodes
    .map((node) => `${'  '.repeat(node.depth)}- ${node.title}`)
    .join('\n')
    .slice(0, OUTLINE_MAX_CHARS)
}

/**
 * Entrée des demandes `synthetiser` / `reviser` (research R4) : nature, arbre complet avec alias, manques
 * connus et, pour une correction, la proposition précédente et la consigne. Anonymisée ensuite par la passerelle.
 */
export function buildSynthesisInput(input: {
  readonly nature: Nature
  readonly nodes: readonly GrowthNode[]
  readonly missing: readonly string[]
  readonly forced: boolean
  readonly revision?: { readonly previous: unknown; readonly instruction: string }
}): string {
  const expected =
    input.nature === 'action'
      ? 'Produis un plan d’action (nœuds, conditions et branches, dépendances, opportunités, manques).'
      : 'Produis une synthèse de réflexion (points clés, décisions, arguments pour et contre, questions ouvertes).'
  const sections = [
    `Nature : ${input.nature === 'action' ? 'Action (à réaliser)' : 'Réflexion (à explorer)'}`,
    `Consigne : ${expected}`,
    ...(input.forced
      ? [
          `Verrouillage forcé : le contexte est incomplet. Manques connus : ${input.missing.join(', ') || 'non évalués'}.`
        ]
      : []),
    ...(input.revision === undefined
      ? []
      : [
          `Proposition précédente :\n${JSON.stringify(input.revision.previous)}`,
          `Correction demandée par l'utilisateur : ${input.revision.instruction}`
        ])
  ]
  const tree = `Arbre de l'idée :\n${treeText(input.nodes)}`
  const budget = MAX_INPUT_CHARS - sections.join('\n\n').length - 2
  return [tree.slice(0, Math.max(budget, 0)), ...sections].join('\n\n')
}
