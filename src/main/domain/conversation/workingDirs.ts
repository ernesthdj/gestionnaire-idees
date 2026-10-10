/**
 * Dossiers d'une conversation (spec 024 D19) : le dossier du projet du canevas est le contexte de toutes ses
 * conversations ; un genesis lié à un autre dossier y a accès en plus, avec les mêmes droits (`--add-dir`).
 */
export interface ConversationDirs {
  /** Dossier de travail ; `null` : celui de l'app. */
  readonly cwd: string | null
  /** Second dossier ouvert à Claude ; `null` : aucun. */
  readonly extra: string | null
}

export function conversationDirs(input: {
  readonly kind: string
  /** Dossier lié au neurone, ou à son genesis. */
  readonly linked: string | null
  /** Dossier du projet du canevas. */
  readonly project: string | null
}): ConversationDirs {
  // Une étape ou un élément travaille dans le dossier de son genesis : ses livrables et ses chemins y sont rangés.
  const structural = input.kind === 'step' || input.kind === 'element'
  const first = structural ? input.linked : input.project
  const second = structural ? input.project : input.linked
  if (first === null) return { cwd: second, extra: null }
  return { cwd: first, extra: second === null || sameDir(first, second) ? null : second }
}

/** Même dossier sous Windows : séparateurs, barre finale et casse ignorés. */
function sameDir(a: string, b: string): boolean {
  const key = (dir: string): string => dir.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return key(a) === key(b)
}
