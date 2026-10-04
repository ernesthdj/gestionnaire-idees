import { execFile } from 'node:child_process'

/**
 * Chemin de l'exécutable `claude` (spec 008 research R7) : résolu une fois par le main via `where.exe`, premier
 * `.exe` trouvé. Jamais construit à partir d'une donnée de l'interface ou de l'utilisateur.
 */
let cached: Promise<string | undefined> | undefined

export function resolveClaudePath(): Promise<string | undefined> {
  cached ??= new Promise((resolve) => {
    execFile('where.exe', ['claude'], { windowsHide: true, timeout: 5000 }, (error, stdout) => {
      if (error !== null) {
        resolve(undefined)
        return
      }
      const exe = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.toLowerCase().endsWith('.exe'))
      resolve(exe)
    })
  })
  return cached
}

/** Après une installation de Claude Code pendant que l'app tourne : on recherche de nouveau. */
export function forgetClaudePath(): void {
  cached = undefined
}
