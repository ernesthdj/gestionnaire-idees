import type { WorkflowItem } from './workflowTree'

/** Ce que le brainstorm d'un rond doit écrire (spec 032 D10, D11) : l'app relit ces fichiers, rien dans la carte. */
const BRAINSTORM_OUTPUT =
  'Tiens à jour l’en-tête du document, sous son titre : « **Maturité** : insuffisant | suffisant | complet » avec ce qui ' +
  'manque. Quand il est complet, écris ses tâches dans docs/TACHES-<Sujet>.md (un titre #, des lots ##, des cases ' +
  '« - [ ] T001 … ») et nomme ce fichier dans l’en-tête par « **Tâches** : docs/TACHES-<Sujet>.md ». Ne pose rien dans ' +
  'la carte de structure.'

/**
 * Règles du projet, rappelées à chaque consigne d'implémentation (spec 032 Q10) : le chat ne charge aucun réglage
 * (`--setting-sources ""`), le CLAUDE.md du projet n'est lu que si on le demande.
 */
const PROJECT_RULES =
  'Avant de commencer, lis le CLAUDE.md du projet et ses règles de travail (docs/claude/ s’il existe) et suis-les. ' +
  'Vérifie avec les commandes du projet (typecheck, lint, format, tests), consigne le changement dans son journal ' +
  '(docs/JOURNAL.md s’il en tient un) : une entrée ajoutée à la FIN du fichier, datée de l’heure locale jointe à mon ' +
  'message (<heure_locale>, jamais une heure devinée), et un fichier qui finit par un saut de ligne ; jamais ' +
  '--no-verify, jamais d’ajout global (git add -A) sans revue, aucun commit sans mon accord.'

/** Un fichier de tâches sans brainstorm (spec 032 Q10) : écrire d'abord sa conception, ses tâches restent des ébauches. */
const writeBrainstormFor = (file: string): string =>
  `${file} n’a pas de brainstorm : ses tâches restent des ébauches. Écris d’abord sa conception dans ` +
  'docs/brainstorm/L1<lettre>-<sujet>.md avec /brainstorm (décisions, choix techniques, ce qui manque), en posant tes ' +
  `questions une à une, avec sous son titre « **Tâches** : ${file} · **Maturité** : insuffisant | suffisant | ` +
  'complet ». Puis précise ou complète les tâches du fichier ; rien n’est implémenté tant que la maturité n’est pas ' +
  '« complet ».'

/** Continuer (ou rouvrir) le brainstorm d'un document. */
const continueBrainstorm = (path: string): string =>
  `Continue le brainstorm de ${path} avec /brainstorm : relis-le, pose tes questions une à une et complète-le. ${BRAINSTORM_OUTPUT}`

/**
 * Consigne de « Discuter » sur un nœud Workflow (spec 023 D6 ; spec 032 D7) : pré-remplie dans la conversation du
 * nœud, jamais envoyée sans geste de mentalyas. Un rond non évalué fait évaluer sa maturité, un rond pas mûr continue
 * son brainstorm, un rond mûr fait rédiger sa doc ; un carré s'implémente ; une ébauche précise sa piste dans le
 * brainstorm d'où elle vient. `null` : le nœud n'a pas de conversation (message). Pure.
 */
export function promptFor(item: WorkflowItem): string | null {
  const { subject } = item
  if (item.sketch === true && (subject.kind === 'task' || subject.kind === 'fileTask')) {
    const task = `« ${subject.task.text.replace(/`/g, '')} »`
    if (item.origin === null || item.origin === undefined) {
      return subject.kind === 'fileTask' ? writeBrainstormFor(subject.file.path) : null
    }
    return (
      `La tâche ${task} est une ébauche : le brainstorm de ${item.origin} n’est pas complet. Continue ce brainstorm ` +
      `en précisant cette piste (la garder, la changer ou l’écarter), sans l’implémenter. ${BRAINSTORM_OUTPUT}`
    )
  }
  switch (subject.kind) {
    case 'task':
      // Tâche faite (D16) : on la relit, on ne la refait pas.
      if (subject.task.done) {
        return `Relis la tâche ${subject.task.id} (faite) de la spec ${subject.spec.dir} (${subject.spec.dir}/tasks.md) : explique ce qu'elle a changé et vérifie qu'elle est complète (fichiers cités, tests).`
      }
      return `Implémente la tâche ${subject.task.id} de la spec ${subject.spec.dir} (${subject.spec.dir}/tasks.md) en suivant /speckit-implement : marque sa case « - [~] » en commençant, lis la spec et le plan, fais la tâche, vérifie, puis coche sa case « - [x] ». ${PROJECT_RULES}`
    case 'story': {
      const ids = subject.story.tasks.filter((task) => !task.done).map((task) => task.id)
      if (ids.length === 0) return null
      return `Mène les tâches restantes de l'US${subject.story.number} « ${subject.story.title} » de la spec ${subject.spec.dir}, dans l'ordre : ${ids.join(', ')}. Coche chaque case quand elle est faite. ${PROJECT_RULES}`
    }
    case 'spec':
      return `Parlons de la spec ${subject.spec.dir} : lis spec.md, plan.md et tasks.md, puis dis-moi où elle en est et ce qu'il reste à faire.`
    case 'doc': {
      const path = subject.doc.path
      if (subject.doc.maturity === null) {
        return (
          `Évalue la maturité du brainstorm de ${path} : lis-le, puis écris dans son en-tête, sous le titre, ` +
          '« **Maturité** : insuffisant | suffisant | complet » avec ce qui manque, et dis-moi la suite.'
        )
      }
      if (subject.doc.maturity !== 'complet') return continueBrainstorm(path)
      return `Relis ${path} et rédige ou complète sa doc (spec ou fiche) : dis-moi d’abord ce qui manque, puis écris.`
    }
    case 'fileTask': {
      const where = `${subject.file.path}${subject.group === null ? '' : `, section « ${subject.group.title} »`}`
      const task = `« ${subject.task.text.replace(/`/g, '')} »`
      if (subject.task.done) {
        return `Relis la tâche ${task} (faite) de ${where} : explique ce qu'elle a changé et vérifie qu'elle est complète.`
      }
      return `Fais la tâche ${task} de ${where}. Avant de commencer, marque sa case « - [~] » dans le fichier ; vérifie ton travail, puis coche-la « - [x] ». Ne change rien d'autre dans le fichier de tâches. ${PROJECT_RULES}`
    }
    case 'taskGroup': {
      const left = [...subject.group.tasks, ...subject.group.groups.flatMap((group) => group.tasks)].filter(
        (task) => !task.done
      )
      if (left.length === 0) return null
      if (item.origin === null || item.origin === undefined) return writeBrainstormFor(subject.file.path)
      return `Mène les tâches restantes de « ${subject.group.title} » dans ${subject.file.path}, dans l'ordre. Pour chacune : marque sa case « - [~] » en commençant, coche-la « - [x] » quand elle est faite et vérifiée. ${PROJECT_RULES}`
    }
    case 'taskFile':
      if (item.origin === null || item.origin === undefined) return writeBrainstormFor(subject.file.path)
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
 * Consigne « Nouveau brainstorm » (spec 023 D26, spec 032 D11) : le brainstorm de départ se fait dans le Workflow ; il
 * aboutit à un document de niveau 1 (son en-tête dit sa maturité et son fichier de tâches) et à ses tâches, que la vue
 * relit ; rien dans la carte de structure. Pure.
 */
export function newBrainstormPrompt(subject: string): string {
  return [
    `Lance /brainstorm sur « ${subject} » pour ce projet : lis d'abord sa fondation et ses documents de brainstorm, ` +
      'puis pose tes questions une à une.',
    'Écris le document de niveau 1 dans docs/brainstorm/ (L1<lettre suivante>-<sujet>.md) dès le début, et tiens à ' +
      'jour son en-tête, sous le titre : « **Maturité** : insuffisant | suffisant | complet » avec ce qui manque ' +
      '(« **Parent** : <document> » s’il prolonge un autre brainstorm). Quand il est complet, écris ses tâches dans ' +
      'docs/TACHES-<Sujet>.md (un titre #, des lots ##, des cases « - [ ] T001 … ») et ajoute « **Tâches** : ' +
      'docs/TACHES-<Sujet>.md » à l’en-tête.',
    'Ne pose rien dans la carte de structure (ni tâche, ni décision, ni étape) : la vue Workflow montre ces fichiers, ' +
      'Progression et Architecture ne font que refléter la doc et le code.'
  ].join('\n')
}

/** Une action de plus sur un nœud, à côté de « Discuter » (spec 032 D7) : son libellé et sa consigne. */
export interface WorkflowAction {
  readonly label: string
  readonly prompt: string
}

/** Actions secondaires d'un nœud : rouvrir le brainstorm d'un rond mûr, évaluer à nouveau sa maturité. Pure. */
export function secondaryActions(item: WorkflowItem): readonly WorkflowAction[] {
  const { subject } = item
  if (subject.kind !== 'doc' || subject.doc.maturity === null) return []
  const path = subject.doc.path
  return subject.doc.maturity === 'complet'
    ? [{ label: 'Rouvrir le brainstorm', prompt: continueBrainstorm(path) }]
    : [
        {
          label: 'Réévaluer la maturité',
          prompt: `Réévalue la maturité du brainstorm de ${path} et mets à jour « **Maturité** » dans son en-tête, avec ce qui manque.`
        }
      ]
}
