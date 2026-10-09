import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { AppError } from '../../domain/errors'

/**
 * File d'écriture git par projet (spec 021 research R4) : deux écritures de l'app sur un même dépôt ne se chevauchent
 * jamais ; une écriture d'un autre programme en cours (`index.lock` présent) donne `BUSY` — le verrou n'est jamais
 * supprimé par l'app. Les lectures passent hors file (`GIT_OPTIONAL_LOCKS=0`).
 */
export class GitWriteQueue {
  private readonly tails = new Map<string, Promise<unknown>>()

  /** Exécute `task` après les écritures déjà en file pour ce projet. */
  async run<T>(key: string, gitDir: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve()
    const next = previous.then(
      () => this.guarded(gitDir, task),
      () => this.guarded(gitDir, task)
    )
    this.tails.set(key, next)
    try {
      return await next
    } finally {
      if (this.tails.get(key) === next) this.tails.delete(key)
    }
  }

  private async guarded<T>(gitDir: string, task: () => Promise<T>): Promise<T> {
    if (existsSync(join(gitDir, 'index.lock'))) {
      throw new AppError(
        'BUSY',
        'Une autre opération git est en cours sur ce dépôt (index.lock) : réessaie dans un instant.'
      )
    }
    return task()
  }
}
