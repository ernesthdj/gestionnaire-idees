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
  /** Verrouillé (spec 011) : Claude dialogue encore, mais n'écrit plus dans ce nœud (D5). */
  readonly locked?: boolean
  /** Étape d'un plan d'attaque (spec 011) : son rang et les nœuds de son chemin, du genesis au parent. */
  readonly step?: {
    readonly label: string
    readonly path: readonly { readonly title: string; readonly label: string | null; readonly sheet: Sheet }[]
  }
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

function stepLines(title: string, id: string, step: NonNullable<NeuronContext['step']>): string {
  const genesis = step.path[0]?.title ?? 'genesis'
  const chain = step.path.map((node) => (node.label === null ? node.title : `${node.label} ${node.title}`))
  const sheets = step.path.map(
    (node) =>
      `Fiche de ${node.label === null ? 'genesis' : `l’étape ${node.label}`} « ${node.title} » :\n${sheetMarkdown(node.sheet)}`
  )
  return [
    `Neurone ouvert : étape ${step.label} « ${title} » (id ${id}) du plan d’attaque de « ${genesis} ».`,
    `Chemin : ${[...chain, `${step.label} ${title}`].join(' › ')}.`,
    'Les fiches du chemin sont la base figée de cette étape : appuie-toi dessus, ne les contredis pas.',
    ...sheets
  ].join('\n')
}

/**
 * Bloc `<contexte_brainstormer>` joint au premier message de chaque ouverture : le nœud, et pour une étape les fiches
 * de son chemin (spec 011). Le message de mentalyas suit, hors du bloc.
 */
export function contextBlock(neuron: NeuronContext): string {
  const lines = [
    '<contexte_brainstormer>',
    neuron.step !== undefined
      ? stepLines(neuron.title, neuron.id, neuron.step)
      : neuron.element === undefined
        ? `Neurone ouvert : genesis « ${neuron.title} » (id ${neuron.id}, couche 1 — vision et cadrage).`
        : elementLines(neuron.title, neuron.id, neuron.element),
    neuron.content === null || neuron.content.trim() === '' ? null : `Description saisie : ${neuron.content.trim()}`,
    `Maturité actuelle : ${neuron.maturity ?? 'non évaluée'}.`,
    neuron.locked === true
      ? 'Nœud VERROUILLÉ : sa fiche, son titre et sa description sont figés — réponds, explique, prépare la suite, ' +
        'mais n’écris plus dans ce nœud (tes écritures seraient refusées).'
      : null,
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
  // Étape profonde : les fiches intermédiaires du chemin partent d'abord ; le genesis et le parent restent.
  const path = neuron.step?.path ?? []
  if (neuron.step !== undefined && path.length > 2) {
    const kept = [path[0], path.at(-1)].filter((node) => node !== undefined)
    return contextBlock({ ...neuron, step: { ...neuron.step, path: kept } })
  }
  return `${block.slice(0, CONTEXT_MAX_CHARS - 80)}\n… [contexte tronqué : relis-le avec neurone_contexte]\n</contexte_brainstormer>`
}

/** Premier message d'une ouverture : contexte, puis le texte de mentalyas. */
export function withContext(neuron: NeuronContext, text: string): string {
  return `${contextBlock(neuron)}\n\n${text}`
}
