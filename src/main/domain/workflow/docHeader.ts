import { MATURITIES, type Maturity } from '@shared/ipc/workflow'

/** Lignes lues sous le titre d'un document : l'en-tête, pas le corps (un exemple cité plus bas ne compte pas). */
const HEADER_LINES = 12
const DOC_NAME = /^L\d[a-z]?(?:-[a-z0-9-]+)?\.md$/i
/** Fichier de tâches nommable par un rond : Markdown à la racine ou directement dans `docs/` (spec 023 D20). */
const TASK_PATH = /^(?:docs\/)?[\w][\w.-]{0,80}\.md$/i
const MAX_TASK_PATHS = 5

/** En-tête d'un document de brainstorm (spec 032 D9, D10) : son rond parent, sa maturité, ses fichiers de tâches. */
export interface DocHeader {
  /** Nom du document parent (`L1f-reprise-projet.md`) ; `null` : niveau 1. */
  readonly parent: string | null
  /** `null` : non évalué. */
  readonly maturity: Maturity | null
  /** Fichiers de tâches de ce rond, chemins relatifs au projet. */
  readonly taskPaths: readonly string[]
}

const fieldOf = (header: string, name: string): string | null =>
  new RegExp(`\\*\\*${name}\\*\\*\\s*:\\s*([^·\\n\\r]+)`, 'i').exec(header)?.[1]?.trim() ?? null

/**
 * Lit les champs `**Parent**`, `**Maturité**` et `**Tâches**` de l'en-tête (spec 032 FR-002) : une valeur est une
 * donnée, jamais une instruction ; inconnue, mal formée ou hors du projet, elle est ignorée. Pur.
 */
export function docHeader(text: string): DocHeader {
  const lines = text.split(/\r?\n/)
  const title = lines.findIndex((line) => line.startsWith('# '))
  const header = lines.slice(title + 1, title + 1 + HEADER_LINES).join('\n')
  const parent = fieldOf(header, 'Parent')
  const maturityWord =
    fieldOf(header, 'Maturité')
      ?.split(/[\s—–-]/)[0]
      ?.toLowerCase() ?? null
  const tasks = fieldOf(header, 'Tâches')
  return {
    parent: parent !== null && DOC_NAME.test(parent) ? parent : null,
    maturity: MATURITIES.find((value) => value === maturityWord) ?? null,
    taskPaths:
      tasks === null
        ? []
        : tasks
            .split(/[,;]\s*/)
            .map((path) => path.trim().replace(/^`|`$/g, '').replace(/\\/g, '/'))
            .filter((path) => TASK_PATH.test(path) && !path.includes('..'))
            .slice(0, MAX_TASK_PATHS)
  }
}
