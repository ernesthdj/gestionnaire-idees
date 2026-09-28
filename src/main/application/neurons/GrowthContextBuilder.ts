import type { Nature } from '@shared/ipc/neurons'
import { aliasesOf, pathTo } from '../../domain/neurons/tree'
import type { GrowthNode } from '../../infrastructure/db/repositories/GrowthRepository'

/** Dimensions de référence par nature (analyse U1) : orientent les questions vers l'exécution ou l'exploration. */
export const REFERENCE_DIMENSIONS: Readonly<Record<Nature, readonly string[]>> = {
  action: ['quand', 'combien', 'comment', "source d'argent", 'lieu', 'dépendances'],
  reflection: ['pourquoi', 'options', 'critères', 'contraintes', 'risques', 'décision attendue']
}

/** Borne du contexte envoyé (≈ 3 000 tokens) : au-delà, les autres branches ne sont plus listées. */
const MAX_INPUT_CHARS = 12_000

export type ExtensionMode = 'first' | 'follow_up' | 'assess_only'

/**
 * Texte d'entrée de la demande `etendre` (research R2) : nature, chemin complet jusqu'au neurone ciblé,
 * titres des autres branches, questions déjà posées. Tout passe ensuite par l'anonymisation de la passerelle.
 */
export function buildGrowthInput(input: {
  readonly nature: Nature
  readonly nodes: readonly GrowthNode[]
  readonly targetId: string
  readonly knownQuestions: readonly string[]
  readonly knownSuggestions: readonly string[]
  readonly answered: number
  readonly mode: ExtensionMode
}): string {
  const path = pathTo(input.nodes, input.targetId)
  const onPath = new Set(path.map((node) => node.id))
  const others = input.nodes.filter((node) => !onPath.has(node.id))
  const alias = aliasesOf(input.nodes)
  const describe = (node: GrowthNode): string =>
    `- [${alias.get(node.id) ?? '?'}] ${node.title}${node.content !== null && node.content !== node.title ? ` — ${node.content}` : ''}`

  const request =
    input.mode === 'first'
      ? 'Premier développement de l’idée : propose AU MOINS 3 questions complémentaires.'
      : input.mode === 'follow_up'
        ? 'Nouvelle réponse sur le neurone ciblé : propose 0 à 3 questions seulement si la réponse ouvre de nouvelles pistes.'
        : 'Profondeur maximale atteinte : ne propose AUCUNE question, évalue seulement le contexte.'

  const sections = [
    `Nature : ${input.nature === 'action' ? 'Action (à réaliser)' : 'Réflexion (à explorer)'}`,
    `Dimensions de référence : ${REFERENCE_DIMENSIONS[input.nature].join(', ')}`,
    `Chemin jusqu'au neurone ciblé [${alias.get(input.targetId) ?? '?'}] :\n${path.map(describe).join('\n')}`,
    `Réponses déjà données : ${input.answered}`,
    `Questions déjà posées (ne pas reproposer) :\n${input.knownQuestions.map((question) => `- ${question}`).join('\n') || '- aucune'}`,
    `Suggestions déjà faites (ne pas reproposer) :\n${input.knownSuggestions.map((title) => `- ${title}`).join('\n') || '- aucune'}`,
    `Consigne : ${request}`
  ]
  const othersSection = `Autres branches (titres) :\n${others.map(describe).join('\n')}`
  const full = [...sections.slice(0, 3), othersSection, ...sections.slice(3)].join('\n\n')
  return full.length <= MAX_INPUT_CHARS ? full : sections.join('\n\n').slice(0, MAX_INPUT_CHARS)
}
