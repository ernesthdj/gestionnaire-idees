import type { Extension } from '@shared/ai/neurons'
import type { HatchedResultView, Nature } from '@shared/ipc/neurons'
import { MIN_EXTENSIONS, suggestionsAllowed } from '../../domain/neurons/guards'
import { REFERENCE_DIMENSIONS } from '../../domain/neurons/nature'
import { aliasesOf, pathTo } from '../../domain/neurons/tree'
import type { GrowthNode } from '../../infrastructure/db/repositories/GrowthRepository'

/** Borne du contexte envoyé (≈ 3 000 tokens) : au-delà, les autres branches ne sont plus listées. */
const MAX_INPUT_CHARS = 12_000
/** Part réservée au document des cycles précédents (≈ 1 000 tokens). */
const DOCUMENT_MAX_CHARS = 4_000
/** Bornes du schéma `Extension` (question ≤ 300, dimension ≤ 40). */
const QUESTION_MAX = 300
const DIMENSION_MAX = 40

const DOCUMENT_SECTIONS = [
  ['keyPoints', 'Points clés'],
  ['decisions', 'Décisions'],
  ['pros', 'Pour'],
  ['cons', 'Contre']
] as const

/** Document d'une idée éclose en texte brut : ce que l'idée sait déjà, pour le cycle de questions suivant. */
export function documentText(result: HatchedResultView): string {
  const list = (items: readonly { readonly text: string }[]): string => items.map((item) => `- ${item.text}`).join('\n')
  if (result.type === 'action_plan') {
    const steps = result.nodes.map(
      (node) => `- ${node.branchLabel === null ? '' : `${node.branchLabel} → `}${node.title} (${node.status})`
    )
    return `Plan d'action :\n${steps.join('\n')}`.slice(0, DOCUMENT_MAX_CHARS)
  }
  const sections = DOCUMENT_SECTIONS.filter(([key]) => result[key].length > 0).map(
    ([key, label]) => `${label} :\n${list(result[key])}`
  )
  if (result.overview !== null) sections.unshift(`En bref : ${result.overview}`)
  if (result.nextStep !== null) sections.push(`Prochaine étape conseillée : ${result.nextStep}`)
  if (result.openQuestions.length > 0) sections.push(`Questions ouvertes :\n${list(result.openQuestions)}`)
  return sections.join('\n\n').slice(0, DOCUMENT_MAX_CHARS)
}

/** Étiquette courte d'une question reprise (titre du sous-neurone « étiquette : réponse ») : coupée à un mot. */
export function dimensionOf(question: string): string {
  const text = question.replace(/\s*\?\s*$/, '').trim()
  if (text.length <= DIMENSION_MAX) return text
  const cut = text.slice(0, DIMENSION_MAX - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > 12 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '')}…`
}

/**
 * Questions laissées ouvertes par le document (T064) : « Approfondir » les reprend telles quelles, sans appel à
 * l'IA. Synthèse de réflexion : ses questions ouvertes ; plan d'action : ses points encore « à trouver ».
 */
export function carriedQuestions(result: HatchedResultView): Extension[] {
  const questions =
    result.type === 'reflection_summary'
      ? result.openQuestions.map((question) => question.text)
      : result.nodes
          .filter((node) => node.investigation && node.status !== 'done' && node.status !== 'abandoned')
          .map((node) => `Qu’as-tu trouvé pour « ${node.title} » ?`)
  return questions.map((question) => ({
    question: question.slice(0, QUESTION_MAX),
    quickReplies: [],
    dimension: dimensionOf(question),
    answerKind: 'answer'
  }))
}

/**
 * `new_cycle` : les questions du cycle viennent du document ; l'IA n'apporte que des idées suggérées et la jauge.
 * `adopted` : l'utilisateur vient d'adopter une idée suggérée ; elle se développe aussitôt à partir de son texte.
 */
export type ExtensionMode = 'first' | 'new_cycle' | 'adopted' | 'follow_up' | 'assess_only'

/** Nombre de questions attendu au minimum (sinon une nouvelle tentative, puis un avertissement). */
export function minimumExtensions(mode: ExtensionMode): number {
  return mode === 'first' ? MIN_EXTENSIONS : mode === 'adopted' ? 2 : 0
}

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
  /** Document des cycles précédents (`documentText`) : l'idée a déjà éclos au moins une fois. */
  readonly document?: string
}): string {
  const path = pathTo(input.nodes, input.targetId)
  const onPath = new Set(path.map((node) => node.id))
  const others = input.nodes.filter((node) => !onPath.has(node.id))
  const alias = aliasesOf(input.nodes)
  const describe = (node: GrowthNode): string =>
    `- [${alias.get(node.id) ?? '?'}] ${node.title}${node.content !== null && node.content !== node.title ? ` — ${node.content}` : ''}`

  const deepening = input.document !== undefined
  // Pas d'idée suggérée tant que l'utilisateur n'a pas assez répondu : sans contexte, elles sont faibles.
  const mayIdeate = suggestionsAllowed(input.answered, deepening)
  const firstIdeas = mayIdeate && input.knownSuggestions.length === 0
  // Le modèle local propose rarement des idées suggérées quand elles sont facultatives (34 % des appels contre 98 %
  // pour Claude, mesuré le 2026-09-29) : la consigne les demande explicitement en début de cycle.
  const request =
    input.mode === 'adopted'
      ? 'L’utilisateur vient d’adopter l’idée suggérée ciblée (son texte est dans le chemin ci-dessus) : propose AU MOINS 2 questions qui la développent à partir de ce texte (comment la mettre en œuvre, ce qu’il faut vérifier ou décider). Propose aussi 1 suggestion si une piste concrète en découle.'
      : input.mode === 'new_cycle'
        ? 'Nouveau cycle : les questions de ce cycle sont déjà posées (questions ouvertes du document) : ne propose AUCUNE question. Propose 1 à 2 suggestions : des pistes concrètes qui vont AU-DELÀ du document. Réévalue le contexte.'
        : input.mode === 'first' && deepening
          ? 'Nouveau cycle : l’idée a déjà un document (ci-dessus). Propose AU MOINS 3 questions qui vont AU-DELÀ du document (questions ouvertes, manques, prochaines étapes) ; ne repose rien de ce qu’il tranche déjà. Propose aussi 1 à 2 suggestions.'
          : input.mode === 'first'
            ? mayIdeate
              ? 'Premier développement de l’idée : propose AU MOINS 3 questions complémentaires et 1 à 2 suggestions.'
              : 'Premier développement de l’idée : propose AU MOINS 3 questions complémentaires. Ne propose AUCUNE suggestion : l’utilisateur n’a pas encore assez répondu pour qu’une idée soit pertinente.'
            : input.mode === 'follow_up'
              ? `Nouvelle réponse sur le neurone ciblé : propose 0 à 3 questions seulement si la réponse ouvre de nouvelles pistes. ${
                  firstIdeas
                    ? 'L’utilisateur a maintenant assez répondu : propose 1 à 2 suggestions, des pistes concrètes tirées de ses réponses.'
                    : mayIdeate
                      ? 'Propose 0 à 1 suggestion, seulement si cette réponse ouvre une piste concrète nouvelle.'
                      : 'Ne propose AUCUNE suggestion : l’utilisateur n’a pas encore assez répondu.'
                }`
              : 'Profondeur maximale atteinte : ne propose AUCUNE question, évalue seulement le contexte.'

  const sections = [
    `Nature : ${input.nature === 'action' ? 'Action (à réaliser)' : 'Réflexion (à explorer)'}`,
    `Dimensions de référence : ${REFERENCE_DIMENSIONS[input.nature].join(', ')}`,
    ...(deepening ? [`Document de l'idée (cycles précédents, déjà acquis) :\n${input.document}`] : []),
    `Chemin jusqu'au neurone ciblé [${alias.get(input.targetId) ?? '?'}] :\n${path.map(describe).join('\n')}`,
    `Réponses déjà données : ${input.answered}`,
    `Questions déjà posées (ne pas reproposer) :\n${input.knownQuestions.map((question) => `- ${question}`).join('\n') || '- aucune'}`,
    `Suggestions déjà faites (ne pas reproposer) :\n${input.knownSuggestions.map((title) => `- ${title}`).join('\n') || '- aucune'}`,
    `Consigne : ${request}`
  ]
  const othersSection = `Autres branches (titres) :\n${others.map(describe).join('\n')}`
  const head = deepening ? 4 : 3
  const full = [...sections.slice(0, head), othersSection, ...sections.slice(head)].join('\n\n')
  return full.length <= MAX_INPUT_CHARS ? full : sections.join('\n\n').slice(0, MAX_INPUT_CHARS)
}
