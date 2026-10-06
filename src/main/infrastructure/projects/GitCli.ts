import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'

export interface GitResult {
  /** `null` : git introuvable, arrêté (délai) ou lancement impossible. */
  readonly code: number | null
  readonly output: string
}

const OUTPUT_MAX = 4_000

/**
 * Chemin absolu de git trouvé dans les dossiers ABSOLUS du PATH ; `null` s'il est absent. Sous Windows, lancer `git`
 * par son seul nom chercherait d'abord dans le dossier courant — celui du projet, où un `git.exe` piégé pourrait
 * attendre.
 */
export function resolveGit(path = process.env['PATH'] ?? ''): string | null {
  const exe = process.platform === 'win32' ? 'git.exe' : 'git'
  for (const dir of path.split(delimiter)) {
    const clean = dir.trim().replace(/^"|"$/g, '')
    if (clean === '' || !isAbsolute(clean)) continue
    const candidate = join(clean, exe)
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * Lance `git` (spec 016 FR-005) : sans shell, arguments fixes construits par le main, dossier imposé, délai borné.
 * Sans dialogue : aucune invite d'identifiants ne peut bloquer l'app.
 */
export function runGit(cwd: string, args: readonly string[], timeoutMs = 30_000): Promise<GitResult> {
  const program = resolveGit()
  if (program === null) return Promise.resolve({ code: null, output: '' })
  return new Promise((resolve) => {
    let output = ''
    let done = false
    const finish = (code: number | null): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code, output: output.trim().slice(-OUTPUT_MAX) })
    }
    const child = spawn(program, [...args], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }
    })
    const collect = (chunk: Buffer): void => {
      output = (output + chunk.toString('utf8')).slice(-OUTPUT_MAX * 2)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    const timer = setTimeout(() => {
      child.kill()
      finish(null)
    }, timeoutMs)
    child.on('error', () => finish(null))
    child.on('close', (code) => finish(code))
  })
}
