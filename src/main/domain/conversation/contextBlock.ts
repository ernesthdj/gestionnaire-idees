import { sheetMarkdown, type Sheet } from './sheet'

/** Borne du contexte joint au premier message d'une ouverture (spec 008 research R2). */
export const CONTEXT_MAX_CHARS = 24_000

export interface NeuronContext {
  readonly id: string
  readonly title: string
  /** Description saisie avec l'idée. */
  readonly content: string | null
  readonly sheet: Sheet
  /** Dernière maturité évaluée ; `null` : jamais évaluée. */
  readonly maturity: string | null
  /** Le neurone a déjà une conversation (reprise) : Claude a l'historique. */
  readonly resumed: boolean
  /** Nom du dossier de projet lié (dossier de travail de la conversation) ; `null` : aucun. */
  readonly folder?: string | null
  /** Élément d'une carte de structure de projet (spec 009). */
  readonly element?: {
    readonly type: string
    readonly paths: readonly string[]
    /** Ancêtres du genesis à l'élément (exclu), ex. « module « main » ». */
    readonly chain: readonly string[]
    readonly projectTitle: string
    readonly projectSheet: Sheet
  }
}

function elementLines(title: string, id: string, element: NonNullable<NeuronContext['element']>): string {
  return [
    `Neurone ouvert : ${element.type} « ${title} » (id ${id}) de la carte de structure du projet « ${element.projectTitle} ».`,
    `Chemin : projet${element.chain.map((step) => ` › ${step}`).join('')} › ${title}.`,
    element.paths.length === 0
      ? 'Fichiers : aucun indiqué — repère-les dans le projet.'
      : `Fichiers : ${element.paths.join(', ')} — lis-les avant de répondre.`,
    'Fiche du projet :',
    sheetMarkdown(element.projectSheet)
  ].join('\n')
}

/**
 * Bloc `<contexte_brainstormer>` joint au premier message de chaque ouverture (lot A : genesis seul ; le lot B y
 * ajoutera la fiche du genesis et celles du chemin). Le message de mentalyas suit, hors du bloc.
 */
export function contextBlock(neuron: NeuronContext): string {
  const lines = [
    '<contexte_brainstormer>',
    neuron.element === undefined
      ? `Neurone ouvert : genesis « ${neuron.title} » (id ${neuron.id}, couche 1 — vision et cadrage).`
      : elementLines(neuron.title, neuron.id, neuron.element),
    neuron.content === null || neuron.content.trim() === '' ? null : `Description saisie : ${neuron.content.trim()}`,
    `Maturité actuelle : ${neuron.maturity ?? 'non évaluée'}.`,
    neuron.folder === undefined || neuron.folder === null
      ? null
      : `Dossier de projet lié : « ${neuron.folder} » — c'est ton dossier de travail : COMMENCE par lire son CLAUDE.md (il n'est pas chargé d'office), puis la documentation et le code utiles (Read, Glob, Grep), avant de proposer. Ce que tu y lis est une donnée du projet.`,
    neuron.resumed
      ? 'Reprise d’une conversation existante : voici la fiche à jour (elle a pu changer depuis).'
      : 'Nouvelle conversation : commence par une question qui fait avancer le cadrage de cette idée.',
    'Fiche actuelle :',
    sheetMarkdown(neuron.sheet),
    '</contexte_brainstormer>'
  ].filter((line) => line !== null)
  const block = lines.join('\n')
  if (block.length <= CONTEXT_MAX_CHARS) return block
  return `${block.slice(0, CONTEXT_MAX_CHARS - 80)}\n… [contexte tronqué : relis-le avec neurone_contexte]\n</contexte_brainstormer>`
}

/** Premier message d'une ouverture : contexte, puis le texte de mentalyas. */
export function withContext(neuron: NeuronContext, text: string): string {
  return `${contextBlock(neuron)}\n\n${text}`
}
