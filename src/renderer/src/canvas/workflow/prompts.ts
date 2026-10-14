import type { WorkflowItem } from './workflowTree'

/**
 * Consigne de « Discuter » sur un nœud Workflow (spec 023 D6, contracts/interfaces.md) : pré-remplie dans la
 * conversation du nœud, jamais envoyée sans geste de mentalyas. `null` : le nœud n'a pas de conversation (branche,
 * message). Pure.
 */
export function promptFor(item: WorkflowItem): string | null {
  const { subject } = item
  switch (subject.kind) {
    case 'task':
      // Tâche faite (D16) : on la relit, on ne la refait pas.
      if (subject.task.done) {
        return `Relis la tâche ${subject.task.id} (faite) de la spec ${subject.spec.dir} (${subject.spec.dir}/tasks.md) : explique ce qu'elle a changé et vérifie qu'elle est complète (fichiers cités, tests).`
      }
      return `Implémente la tâche ${subject.task.id} de la spec ${subject.spec.dir} (${subject.spec.dir}/tasks.md) en suivant /speckit-implement : marque sa case « - [~] » en commençant, lis la spec et le plan, fais la tâche, vérifie (typecheck, lint, tests), puis coche sa case « - [x] ».`
    case 'story': {
      const ids = subject.story.tasks.filter((task) => !task.done).map((task) => task.id)
      if (ids.length === 0) return null
      return `Mène les tâches restantes de l'US${subject.story.number} « ${subject.story.title} » de la spec ${subject.spec.dir}, dans l'ordre : ${ids.join(', ')}. Coche chaque case quand elle est faite.`
    }
    case 'socle': {
      const ids = subject.spec.socle.filter((task) => !task.done).map((task) => task.id)
      if (ids.length === 0) return null
      return `Mène les tâches restantes du socle (sans user story) de la spec ${subject.spec.dir}, dans l'ordre : ${ids.join(', ')}. Coche chaque case quand elle est faite.`
    }
    case 'spec':
      return `Parlons de la spec ${subject.spec.dir} : lis spec.md, plan.md et tasks.md, puis dis-moi où elle en est et ce qu'il reste à faire.`
    case 'doc':
      return `Lance /brainstorm à partir de docs/brainstorm/${subject.doc.name} (idée à brainstormer de ce projet).`
    case 'fileTask': {
      const where = `${subject.file.path}${subject.group === null ? '' : `, section « ${subject.group.title} »`}`
      const task = `« ${subject.task.text.replace(/`/g, '')} »`
      if (subject.task.done) {
        return `Relis la tâche ${task} (faite) de ${where} : explique ce qu'elle a changé et vérifie qu'elle est complète.`
      }
      return `Fais la tâche ${task} de ${where}. Avant de commencer, marque sa case « - [~] » dans le fichier ; vérifie ton travail, puis coche-la « - [x] ». Ne change rien d'autre dans le fichier de tâches.`
    }
    case 'taskGroup': {
      const left = [...subject.group.tasks, ...subject.group.groups.flatMap((group) => group.tasks)].filter(
        (task) => !task.done
      )
      if (left.length === 0) return null
      return `Mène les tâches restantes de « ${subject.group.title} » dans ${subject.file.path}, dans l'ordre. Pour chacune : marque sa case « - [~] » en commençant, coche-la « - [x] » quand elle est faite et vérifiée.`
    }
    case 'taskFile':
      return `Parlons de ${subject.file.path} : lis-le, puis dis-moi où en est le projet (tâches faites, en cours, à faire) et quoi faire ensuite.`
    default:
      return null
  }
}

/** Étape née dans une vue d'un projet lié (spec 023 D23, D28). */
export interface WorkflowStepRef {
  readonly id: string
  readonly parentId: string
  readonly title: string
  readonly rank: number
}

/** Tâche ou décision posée dans la carte de structure avant D27 (spec 023 D28). */
export interface StrayElement {
  readonly id: string
  readonly parentId: string
  readonly title: string
  readonly type: 'tache' | 'decision'
}

/** Arbre d'éléments en liste Markdown indentée, depuis `rootId` (frères dans l'ordre donné). */
function treeLines<T extends { readonly id: string; readonly parentId: string }>(
  items: readonly T[],
  label: (item: T) => string,
  isRoot: (item: T) => boolean
): string[] {
  const lines: string[] = []
  const walk = (item: T, depth: number): void => {
    lines.push(`${'  '.repeat(depth)}- ${label(item)}`)
    for (const child of items.filter((entry) => entry.parentId === item.id)) walk(child, depth + 1)
  }
  for (const item of items.filter(isRoot)) walk(item, 0)
  return lines
}

/**
 * Consigne « Les reporter dans les fichiers » (spec 023 D23, D28) : les étapes (dans leur ordre et leur hiérarchie) et
 * les tâches et décisions posées dans la carte, à reporter dans les fichiers du projet, sans doublon. Pure.
 */
export function reportStepsPrompt(
  genesisId: string,
  steps: readonly WorkflowStepRef[],
  elements: readonly StrayElement[] = []
): string {
  const ordered = [...steps].sort((a, b) => a.rank - b.rank)
  const stepIds = new Set(steps.map((step) => step.id))
  const elementIds = new Set(elements.map((element) => element.id))
  const lines = [
    ...treeLines(
      ordered,
      (step) => step.title,
      (step) => step.parentId === genesisId || !stepIds.has(step.parentId)
    ),
    ...treeLines(
      elements,
      (element) => `${element.type === 'tache' ? 'Tâche' : 'Décision'} : ${element.title}`,
      (element) => !elementIds.has(element.parentId)
    )
  ]
  return [
    'Le travail de ce projet se fait dans la vue Workflow, qui se lit dans ses fichiers. Ceci a été posé sur la carte :',
    ...lines,
    '',
    'Ajoute les étapes et les tâches comme tâches (« - [ ] », hiérarchie gardée par des titres ## et ###) dans le fichier ' +
      'de tâches du projet qui convient (ou dans le tasks.md de la spec concernée), et les décisions dans sa doc (spec ' +
      'ou brainstorm concerné), sans créer de doublon. Dis-moi ensuite où tu les as mises : je retirerai ces nœuds de ' +
      'la carte.'
  ].join('\n')
}

/** Ce que signale la barre : étapes masquées en Workflow (D23), posées hors du Workflow ailleurs (D28). */
export function strayLabel(view: 'workflow' | 'progression' | 'architecture', steps: number, elements: number): string {
  const plural = (count: number, word: string): string => `${count} ${word}${count > 1 ? 's' : ''}`
  if (view === 'workflow')
    return `${plural(steps, 'étape')} générée${steps > 1 ? 's' : ''} masquée${steps > 1 ? 's' : ''}`
  const parts = [
    steps === 0 ? null : plural(steps, 'étape'),
    elements === 0 ? null : `${plural(elements, 'tâche')} ou décision${elements > 1 ? 's' : ''}`
  ].filter((part) => part !== null)
  return `${parts.join(' et ')} à reporter dans le Workflow`
}

/** Longueur d'un sujet de brainstorm (spec 023 D26). */
export const BRAINSTORM_SUBJECT_MAX = 120

/** Sujet tapé par mentalyas, sur une ligne, sans ce qui casserait la consigne (guillemets, accents graves) ; `null` : vide. */
export function brainstormSubject(raw: string): string | null {
  const subject = raw
    .replace(/[`«»"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, BRAINSTORM_SUBJECT_MAX)
    .trim()
  return subject === '' ? null : subject
}

/**
 * Consigne « Nouveau brainstorm » (spec 023 D26) : le brainstorm de départ se fait dans le Workflow ; il aboutit à un
 * document de niveau 1 et à son fichier de tâches, que la vue relit ; rien dans la carte de structure. Pure.
 */
export function newBrainstormPrompt(subject: string): string {
  return [
    `Lance /brainstorm sur « ${subject} » pour ce projet : lis d'abord sa fondation et ses documents de brainstorm, ` +
      'puis pose tes questions une à une.',
    'À la fin, écris le document de niveau 1 dans docs/brainstorm/ (L1<lettre suivante>-<sujet>.md), puis ses tâches ' +
      'dans docs/TACHES-<Sujet>.md : un titre #, des lots ##, des cases « - [ ] T001 … ».',
    'Ne pose rien dans la carte de structure (ni tâche, ni décision, ni étape) : la vue Workflow montre ces fichiers, ' +
      'Progression et Architecture ne font que refléter la doc et le code.'
  ].join('\n')
}
