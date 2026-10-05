import { EMPTY_SHEET, SHEET_MAX_CHARS, type Sheet } from './sheet'

/**
 * Conversion des idées de l'ancien moteur (spec 010 US3) : la fiche est assemblée localement, sans IA, à partir des
 * réponses, du document éclos (synthèse de réflexion ou plan d'action) et de la prochaine étape. Fonctions pures.
 */

export interface LegacyPoint {
  readonly headline: string | null
  readonly text: string
}

export type LegacyDocument =
  | {
      readonly type: 'reflection_summary'
      readonly overview: string | null
      readonly nextStep: string | null
      readonly keyPoints: readonly LegacyPoint[]
      readonly decisions: readonly LegacyPoint[]
      readonly pros: readonly LegacyPoint[]
      readonly cons: readonly LegacyPoint[]
      readonly openQuestions: readonly string[]
    }
  | {
      readonly type: 'action_plan'
      readonly nodes: readonly LegacyPlanNode[]
    }

export interface LegacyPlanNode {
  readonly type: 'task' | 'condition' | 'opportunity'
  readonly title: string
  readonly status: 'blocked' | 'ready' | 'in_progress' | 'done' | 'abandoned'
  readonly activeBranch: boolean
}

/** Sous-neurone de l'ancien arbre ; `question` : la question à laquelle il répond, s'il en vient d'une. */
export interface LegacyAnswer {
  readonly kind: string
  readonly title: string
  readonly content: string | null
  readonly question: string | null
}

export interface LegacyIdea {
  readonly id: string
  readonly answers: readonly LegacyAnswer[]
  readonly document: LegacyDocument | null
}

const ITEM_MAX = 500
const RESUME_MAX = 1000
const SECTION_MAX = 30

const STATUS_NAMES: Readonly<Record<LegacyPlanNode['status'], string>> = {
  blocked: 'bloquée',
  ready: 'à faire',
  in_progress: 'en cours',
  done: 'faite',
  abandoned: 'abandonnée'
}

const clip = (text: string, max: number): string => {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

const pointText = (point: LegacyPoint): string =>
  point.headline === null || point.headline.trim() === '' ? point.text : `${point.headline} : ${point.text}`

/** Prochaine étape : celle de la synthèse, ou la première tâche en cours / à faire d'une branche retenue du plan. */
export function legacyNextStep(document: LegacyDocument | null): string | null {
  if (document === null) return null
  if (document.type === 'reflection_summary') {
    const step = document.nextStep?.trim() ?? ''
    return step === '' ? null : step
  }
  const open = document.nodes.filter((node) => node.type === 'task' && node.activeBranch)
  const next = open.find((node) => node.status === 'in_progress') ?? open.find((node) => node.status === 'ready')
  return next?.title ?? null
}

function documentSections(
  document: LegacyDocument | null
): Pick<Sheet, 'resume' | 'points_cles' | 'decisions' | 'questions_ouvertes'> {
  if (document === null) return { resume: '', points_cles: [], decisions: [], questions_ouvertes: [] }
  if (document.type === 'action_plan') {
    const nodes = document.nodes.filter((node) => node.activeBranch)
    return {
      resume: '',
      points_cles: nodes.map((node) =>
        node.type === 'task'
          ? `Tâche (${STATUS_NAMES[node.status]}) : ${node.title}`
          : `${node.type === 'condition' ? 'Condition' : 'Opportunité'} : ${node.title}`
      ),
      decisions: [],
      questions_ouvertes: []
    }
  }
  return {
    resume: document.overview ?? '',
    points_cles: [
      ...document.keyPoints.map(pointText),
      ...document.pros.map((point) => `Pour : ${pointText(point)}`),
      ...document.cons.map((point) => `Contre : ${pointText(point)}`)
    ],
    decisions: document.decisions.map(pointText),
    questions_ouvertes: [...document.openQuestions]
  }
}

/** Réponse « question → réponse » ; une piste « à trouver » devient un manque. */
function answerItems(answers: readonly LegacyAnswer[]): { readonly points: string[]; readonly missing: string[] } {
  const points: string[] = []
  const missing: string[] = []
  for (const answer of answers) {
    if (answer.kind === 'investigation') {
      missing.push(answer.question === null ? answer.title : `À trouver : ${answer.question}`)
    } else if (answer.question !== null) {
      points.push(`${answer.question} → ${answer.content ?? answer.title}`)
    } else {
      points.push(
        answer.content === null || answer.content === answer.title
          ? answer.title
          : `${answer.title} : ${answer.content}`
      )
    }
  }
  return { points, missing }
}

const items = (texts: readonly string[]): string[] =>
  texts
    .map((text) => clip(text, ITEM_MAX))
    .filter((text) => text !== '')
    .slice(0, SECTION_MAX)

/** Sections rognées quand la fiche dépasse sa borne ; à égalité, la première de la liste (réponses en fin de points). */
const TRIMMABLE = ['points_cles', 'manques', 'questions_ouvertes', 'decisions'] as const

/** Fiche d'une ancienne idée ; vide si elle n'avait ni réponse ni document. Toujours dans les bornes de `Sheet`. */
export function legacySheet(idea: LegacyIdea): Sheet {
  const document = documentSections(idea.document)
  const answers = answerItems(idea.answers)
  const step = legacyNextStep(idea.document)
  const sheet: Sheet = {
    resume: clip(document.resume, RESUME_MAX),
    points_cles: items([
      ...(step === null ? [] : [`Prochaine étape : ${step}`]),
      ...document.points_cles,
      ...answers.points
    ]),
    decisions: items(document.decisions),
    questions_ouvertes: items(document.questions_ouvertes),
    manques: items(answers.missing)
  }
  // Trop longue : on retire le dernier point de la section la plus fournie, pour répartir les pertes.
  while (JSON.stringify(sheet).length > SHEET_MAX_CHARS) {
    const longest = TRIMMABLE.reduce((best, name) => (sheet[name].length > sheet[best].length ? name : best))
    if (sheet[longest].length === 0) return EMPTY_SHEET
    sheet[longest].pop()
  }
  return sheet
}
