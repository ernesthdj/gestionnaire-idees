/**
 * Bornes de la lecture d'un projet pour la vue Workflow (spec 023, research R3) : les fichiers d'un projet importé ne
 * sont pas fiables ; au-delà, ils sont ignorés ou tronqués et la spec est marquée « lecture partielle ».
 */
export const WORKFLOW_LIMITS = {
  /** Taille d'un fichier de méthode lu (spec.md, tasks.md, documents de brainstorm, fondation). */
  fileBytes: 512 * 1024,
  specs: 200,
  tasksPerSpec: 1000,
  brainstormDocs: 300,
  /** Fichiers de tâches hors Spec Kit (D20). */
  taskFiles: 50,
  pathsPerTask: 20,
  taskText: 500,
  statusLine: 200,
  title: 200,
  foundationSummary: 600
} as const

/** Coupe un texte à `max` caractères, avec une ellipse. */
export const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`)
