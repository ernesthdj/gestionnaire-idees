// Contrats IPC « Genesis → projet » (spec 016).

/** Types de projet, ceux du lanceur ProjectMaster (`pm.bat`). */
export const PROJECT_TYPES = [
  'Web App',
  'Desktop App',
  'Desktop + Web App',
  'Mobile App',
  'CLI / Script',
  'Knowledge Base',
  'Workspace'
] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

export const PROJECT_LIMITS = { name: 100, description: 300 } as const

export interface ProjectSettingsView {
  /** Racine des projets ; `null` : pas encore choisie (demandée à la première création). */
  readonly root: string | null
  /** La racine est le dossier `projects/` d'un workspace ProjectMaster : les projets y sont inscrits au registre. */
  readonly hub: boolean
}

export interface ProjectCreateInput {
  readonly neuronId: string
  readonly name: string
  readonly slug: string
  readonly type: ProjectType
  readonly description: string
}

/** Résultat d'une création : `null` si mentalyas a annulé le choix de la racine. */
export interface ProjectCreatedView {
  readonly folder: string
  readonly registered: boolean
}
