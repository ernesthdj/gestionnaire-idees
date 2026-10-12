import type { FolderFileView, FolderSource } from '@shared/ipc/folders'

/**
 * Règles du dossier d'un nœud (spec 028 R1, data-model) : une ligne par fichier, la source la plus forte ; documents
 * d'abord, puis du plus récent au plus ancien ; « nouveau » quand Claude a écrit après la dernière ouverture. Pures.
 */

/** Plafond de fichiers d'un dossier : au-delà, plus rien n'est rangé et « Tout voir » le signale. */
export const FOLDER_FILE_MAX = 500

const STRENGTH: Readonly<Record<FolderSource, number>> = { document: 3, manual: 2, conversation: 1, covered: 0 }

/** Clé d'unicité d'un chemin : sous Windows, la casse ne distingue pas deux fichiers. */
export const pathKey = (path: string): string => path.replace(/\\/g, '/').toLowerCase()

/** Une seule ligne par fichier : la source la plus forte l'emporte (document > ajouté > conversation > couvert). */
export function mergeFolderFiles(files: readonly FolderFileView[]): FolderFileView[] {
  const byKey = new Map<string, FolderFileView>()
  for (const file of files) {
    const key = pathKey(file.path)
    const kept = byKey.get(key)
    if (kept === undefined || STRENGTH[file.source] > STRENGTH[kept.source]) {
      byKey.set(key, kept === undefined ? file : { ...file, unseen: file.unseen || kept.unseen })
    } else if (file.unseen && !kept.unseen) {
      byKey.set(key, { ...kept, unseen: true })
    }
  }
  return [...byKey.values()]
}

/** Documents d'abord (ceux de l'app, puis les fichiers de doc), puis le plus récent ; à égalité, par nom. */
export function sortFolderFiles(files: readonly FolderFileView[]): FolderFileView[] {
  return [...files].sort(
    (a, b) =>
      Number(b.source === 'document') - Number(a.source === 'document') ||
      Number(b.kind === 'doc') - Number(a.kind === 'doc') ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.name.localeCompare(b.name)
  )
}

/** « Nouveau » : écrit par Claude après la dernière ouverture du dossier (jamais ouvert : tout ce que Claude a écrit). */
export function isUnseen(writtenByClaudeAt: string | null, seenAt: string | null): boolean {
  if (writtenByClaudeAt === null) return false
  return seenAt === null || writtenByClaudeAt > seenAt
}
