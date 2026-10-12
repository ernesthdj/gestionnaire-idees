import { z } from 'zod'
import { FOLDER_OFFSET_MAX } from '@shared/ipc/folders'
import { AppError } from '../domain/errors'
import type { FolderService } from '../application/folders/FolderService'
import { defineRoute, type IpcRoute } from './registry'

export interface FolderRouteDeps {
  readonly folders: Pick<FolderService, 'move' | 'markSeen' | 'add' | 'remove' | 'hide' | 'unhide' | 'file'>
  /**
   * Sélecteur natif dans le dossier du projet du nœud : chemin relatif choisi, `undefined` si annulé ou sans projet,
   * `null` si le fichier choisi est hors du projet.
   */
  readonly pickFile: (neuronId: string) => Promise<string | null | undefined>
}

const Offset = z.number().finite().min(-FOLDER_OFFSET_MAX).max(FOLDER_OFFSET_MAX)
/** Chemin relatif d'un fichier du dossier ; revérifié par le service (`checkProjectPath`, `realpath`). */
const FilePath = z.string().min(1).max(512)
const Target = z.strictObject({ neuronId: z.uuid(), path: FilePath })

/** Canaux `folder:*` (spec 028 contracts/ipc-folders.md) — chaque charge utile est validée. */
export function createFolderRoutes(deps: FolderRouteDeps): IpcRoute[] {
  return [
    defineRoute({
      channel: 'folder:move',
      input: z.strictObject({ neuronId: z.uuid(), x: Offset, y: Offset }),
      handler: async ({ neuronId, x, y }) => {
        deps.folders.move(neuronId, x, y)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'folder:markSeen',
      input: z.strictObject({ neuronId: z.uuid() }),
      handler: async ({ neuronId }) => {
        deps.folders.markSeen(neuronId)
        return { ok: true }
      }
    }),
    defineRoute({
      channel: 'folder:pickFile',
      input: z.strictObject({ neuronId: z.uuid() }),
      handler: async ({ neuronId }) => {
        const picked = await deps.pickFile(neuronId)
        if (picked === undefined) return null
        if (picked === null) throw new AppError('VALIDATION', 'Seuls les fichiers du projet peuvent être rangés.')
        return deps.folders.add(neuronId, picked)
      }
    }),
    defineRoute({
      channel: 'folder:add',
      input: Target,
      handler: async ({ neuronId, path }) => deps.folders.add(neuronId, path)
    }),
    defineRoute({
      channel: 'folder:remove',
      input: Target,
      handler: async ({ neuronId, path }) => deps.folders.remove(neuronId, path)
    }),
    defineRoute({
      channel: 'folder:hide',
      input: Target,
      handler: async ({ neuronId, path }) => deps.folders.hide(neuronId, path)
    }),
    defineRoute({
      channel: 'folder:unhide',
      input: Target,
      handler: async ({ neuronId, path }) => deps.folders.unhide(neuronId, path)
    }),
    defineRoute({
      channel: 'folder:file',
      input: Target,
      handler: async ({ neuronId, path }) => deps.folders.file(neuronId, path)
    })
  ]
}
