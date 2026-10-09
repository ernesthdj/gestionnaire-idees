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
      return `Implémente la tâche ${subject.task.id} de la spec ${subject.spec.dir} (${subject.spec.dir}/tasks.md) en suivant /speckit-implement : lis la spec et le plan, fais la tâche, vérifie (typecheck, lint, tests), puis coche sa case.`
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
    default:
      return null
  }
}
