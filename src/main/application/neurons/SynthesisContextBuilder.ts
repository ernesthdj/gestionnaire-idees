import type { NeuronKind, Nature } from '@shared/ipc/neurons'
import { aliasesOf } from '../../domain/neurons/tree'
import type { GrowthNode } from '../../infrastructure/db/repositories/GrowthRepository'

/**
 * Borne de l'entrée de la synthèse (≈ 10 000 tokens) : large, pour que TOUTE l'arborescence d'une idée — toutes ses
 * branches, cycles précédents compris — arrive à Claude (décision du 2026-09-30).
 */
const MAX_INPUT_CHARS = 40_000
const OUTLINE_MAX_CHARS = 2_000

const KIND_LABELS: Readonly<Record<NeuronKind, string>> = {
  root: 'idée',
  answer: 'réponse',
  condition: 'condition',
  branch: 'branche',
  opportunity: 'opportunité',
  investigation: 'à trouver',
  user_branch: 'piste ajoutée',
  idea: 'idée suggérée'
}

function line(node: GrowthNode, alias: string, depth: number): string {
  const detail = node.content !== null && node.content !== node.title ? ` — ${node.content}` : ''
  const question = node.question === null || node.question === undefined ? '' : ` (en réponse à : « ${node.question} »)`
  return `${'  '.repeat(depth)}- [${alias}] (${KIND_LABELS[node.kind]}) ${node.title}${detail}${question}`
}

/**
 * Arbre complet, chaque nœud précédé de son alias (`sourceRefs`) et placé SOUS son parent (parcours en profondeur) :
 * l'IA lit chaque branche d'un seul tenant. Les alias restent ceux de l'ordre de création (contrôle de provenance).
 * Un nœud dont le parent manque est rattaché à la racine plutôt que perdu.
 */
export function treeText(nodes: readonly GrowthNode[]): string {
  const alias = aliasesOf(nodes)
  const known = new Set(nodes.map((node) => node.id))
  const roots: GrowthNode[] = []
  const children = new Map<string, GrowthNode[]>()
  for (const node of nodes) {
    if (node.parentId === null || !known.has(node.parentId)) roots.push(node)
    else children.set(node.parentId, [...(children.get(node.parentId) ?? []), node])
  }
  const top = roots.find((node) => node.kind === 'root')
  const lines: string[] = []
  const seen = new Set<string>()
  const walk = (node: GrowthNode, depth: number): void => {
    if (seen.has(node.id)) return
    seen.add(node.id)
    lines.push(line(node, alias.get(node.id) ?? '?', depth))
    for (const child of children.get(node.id) ?? []) walk(child, depth + 1)
  }
  if (top !== undefined) walk(top, 0)
  for (const orphan of roots) walk(orphan, top === undefined ? 0 : 1)
  return lines.join('\n')
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
    'Parcours TOUT l’arbre, branche par branche, jusqu’aux feuilles : chaque branche, chaque réponse et chaque idée suggérée adoptée doit se retrouver dans le résultat (ou, si rien n’est tranché, dans ce qui reste ouvert). Ne t’arrête pas aux premiers niveaux.',
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
