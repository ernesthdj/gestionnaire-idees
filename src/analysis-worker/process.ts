import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import type { Engine } from './engine'
import { extractFile, type FileExtraction } from './extract'
import type { ParseRequest, WorkerMessage } from './protocol'

/** Message envoyé au main (revalidé par Zod à l'arrivée, `WorkerMessage`). */
export type WorkerOutput =
  | Exclude<WorkerMessage, { readonly type: 'file' }>
  | {
      readonly type: 'file'
      readonly id: string
      readonly hash: string
      readonly lines: number
      readonly extraction: FileExtraction
    }

/** Taille maximale d'un fichier analysé (spec 017 FR-013). */
export const WORKER_FILE_MAX_BYTES = 1024 * 1024

/**
 * Traite un lot de fichiers (spec 017 R2) : chaque fichier est résolu sous la racine (jamais au-delà, jamais un
 * lien), lu, haché ; inchangé → rien n'est extrait ; sinon sa structure est extraite. Un fichier en erreur n'arrête
 * pas le lot. Le processus rend la main entre deux fichiers : une annulation (`cancelled`) y est prise en compte.
 */
export async function processBatch(
  engine: Engine,
  request: ParseRequest,
  post: (message: WorkerOutput) => void,
  cancelled: () => boolean = () => false
): Promise<void> {
  const root = realpathSync(request.root)
  for (const file of request.files) {
    await new Promise((done) => setImmediate(done))
    if (cancelled()) {
      post({ type: 'done', cancelled: true })
      return
    }
    const target = join(root, ...file.path.split('/'))
    const inside = relative(root, target)
    let content: Buffer
    try {
      if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) throw new Error('hors du projet')
      const stat = lstatSync(target)
      if (!stat.isFile()) throw new Error('pas un fichier')
      if (stat.size > WORKER_FILE_MAX_BYTES) {
        post({
          type: 'fileError',
          id: file.id,
          status: 'too_large',
          reason: 'fichier de plus de 1 Mo',
          hash: null,
          lines: 0
        })
        continue
      }
      content = readFileSync(target)
    } catch {
      post({ type: 'fileError', id: file.id, status: 'parse_error', reason: 'fichier illisible', hash: null, lines: 0 })
      continue
    }
    const hash = createHash('sha256').update(content).digest('hex')
    if (hash === file.knownHash) {
      post({ type: 'unchanged', id: file.id })
      continue
    }
    const result = extractFile(engine, file.lang, content.toString('utf8'))
    post(
      result.ok
        ? { type: 'file', id: file.id, hash, lines: result.lines, extraction: result.extraction }
        : { type: 'fileError', id: file.id, status: 'parse_error', reason: result.reason, hash, lines: result.lines }
    )
  }
  post({ type: 'done', cancelled: false })
}
