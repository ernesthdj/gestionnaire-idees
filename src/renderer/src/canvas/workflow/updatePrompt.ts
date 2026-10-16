import type { WorkflowView } from '@shared/ipc/workflow'

/** Ce qui manque à un projet pour que son Workflow s'affiche en entier (spec 032 D17). */
export interface WorkflowGaps {
  /** Documents de brainstorm sans en-tête de maturité. */
  readonly docsWithoutHeader: readonly string[]
  /** Fichiers de tâches qu'aucun brainstorm complet ne nomme : leurs tâches restent des ébauches. */
  readonly sketchedFiles: readonly string[]
  /** Ni spec ni fichier de tâches : aucune tâche n'est lue. */
  readonly noTasks: boolean
}

export function workflowGaps(view: WorkflowView): WorkflowGaps {
  return {
    docsWithoutHeader: view.brainstorm.filter((doc) => doc.maturity === null).map((doc) => doc.name),
    sketchedFiles: view.taskFiles
      .filter((file) => !view.brainstorm.some((doc) => doc.maturity === 'complet' && doc.taskPaths.includes(file.path)))
      .map((file) => file.path),
    noTasks: view.taskFiles.length === 0 && view.specs.length === 0
  }
}

const list = (items: readonly string[]): string =>
  items.length <= 12 ? items.join(', ') : `${items.slice(0, 12).join(', ')} et ${items.length - 12} autre(s)`

/**
 * « ↻ Mettre à jour » dans la vue Workflow (spec 032 D17) : Claude remet les fichiers du projet au format du Workflow
 * (en-têtes des brainstorms, fichiers de tâches à trois états, état réel des cases) pour que l'arbre s'affiche avec son
 * « ▶ Bosser ici ». L'app dit ce qui manque ; Claude ne touche pas au code et n'invente rien. Pure.
 */
export function workflowUpdatePrompt(view: WorkflowView): string {
  const gaps = workflowGaps(view)
  const seen = [
    gaps.docsWithoutHeader.length === 0
      ? null
      : `- Brainstorms sans en-tête (ni maturité ni tâches) : ${list(gaps.docsWithoutHeader)}.`,
    gaps.sketchedFiles.length === 0
      ? null
      : `- Fichiers de tâches qu’aucun brainstorm complet ne nomme (leurs tâches restent des ébauches) : ${list(
          gaps.sketchedFiles
        )}.`,
    gaps.noTasks ? '- Aucun fichier de tâches ni aucune spec : aucune tâche n’est lue.' : null
  ].filter((line): line is string => line !== null)
  return [
    'Mets à jour le Workflow de ce projet : remets ses fichiers au format que la vue Workflow lit, pour que ses tâches ' +
      's’affichent et que la prochaine soit désignée. Ne touche pas au code et n’invente rien.',
    seen.length === 0 ? 'L’app ne voit rien de manquant : vérifie surtout l’état des cases.' : 'Ce que l’app voit :',
    ...seen,
    '1. Lis docs/JOURNAL.md, les derniers commits (git log) et ce qu’il faut du code pour savoir ce qui est fait.',
    '2. Sous le titre de chaque document de docs/brainstorm/, l’en-tête : « **Parent** : <document> · **Maturité** : ' +
      'insuffisant | suffisant | complet · **Tâches** : docs/TACHES-<Sujet>.md » (Parent seulement s’il prolonge un ' +
      'autre brainstorm ; maturité honnête, avec ce qui manque si elle n’est pas complète).',
    '3. Les tâches prévues qui ne sont dans aucun fichier de tâches (documents, TODO, « Reste » du JOURNAL) : range-les ' +
      'dans docs/TACHES-<Sujet>.md (un titre #, des lots ##, des cases « - [ ] T001 … ») et nomme ce fichier dans ' +
      'l’en-tête de son brainstorm.',
    '4. Coche l’état réel de chaque case : « - [x] » faite (vue dans le code ou le JOURNAL), « - [~] » en cours, ' +
      '« - [ ] » à faire. Ne coche rien que tu n’as pas vérifié.',
    '5. Résume en quelques lignes ce que tu as changé, et dis quelle tâche est la prochaine à faire.'
  ].join('\n')
}
