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

/** Étape née dans la vue Workflow avant D22 (spec 023 D23). */
export interface WorkflowStepRef {
  readonly id: string
  readonly parentId: string
  readonly title: string
  readonly rank: number
}

/**
 * Consigne « Les reporter dans les fichiers » (spec 023 D23) : les étapes, dans leur ordre et leur hiérarchie, à
 * ajouter comme tâches dans le fichier de tâches qui convient, sans doublon. Pure.
 */
export function reportStepsPrompt(genesisId: string, steps: readonly WorkflowStepRef[]): string {
  const lines: string[] = []
  const walk = (parentId: string, depth: number): void => {
    for (const step of steps.filter((entry) => entry.parentId === parentId).sort((a, b) => a.rank - b.rank)) {
      lines.push(`${'  '.repeat(depth)}- ${step.title}`)
      walk(step.id, depth + 1)
    }
  }
  walk(genesisId, 0)
  return [
    'Ces étapes ont été générées dans la vue Workflow, qui ne se lit plus que dans les fichiers du projet :',
    ...lines,
    '',
    'Ajoute-les comme tâches (« - [ ] », hiérarchie gardée par des titres ## et ###) dans le fichier de tâches du ' +
      'projet qui convient (ou dans le tasks.md de la spec concernée), sans créer de doublon avec une tâche existante. ' +
      'Dis-moi ensuite dans quel fichier tu les as mises : je retirerai les étapes de la carte.'
  ].join('\n')
}
