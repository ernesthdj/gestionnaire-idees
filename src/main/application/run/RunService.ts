import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, isAbsolute, join, relative } from 'node:path'
import type { RunOutputEvent, RunScriptsView, RunView } from '@shared/run/run'
import { projectKey } from '../../domain/conversation/permissions'
import { AppError } from '../../domain/errors'
import { defaultFavorite, scriptsOf, type ScriptView } from '../../domain/run/scripts'
import type { NpmProgram } from '../../infrastructure/analyste/NpmCli'
import { stopTree } from '../../infrastructure/process/ProcessRunner'

export interface RunDeps {
  /** Dossier du projet lié au genesis ; `undefined` : genesis inconnu ; `null` : pas de dossier. */
  readonly projectDir: (genesisId: string) => string | null | undefined
  readonly isTrusted: (key: string) => boolean
  readonly setTrusted: (key: string, trusted: boolean) => void
  /** `node` + `npm-cli.js` résolus par chemin absolu ; `null` : introuvables. */
  readonly npm: () => NpmProgram | null
  readonly favorites: {
    runFavorite(genesisId: string): string | null
    saveRunFavorite(genesisId: string, script: string): void
  }
  /** Dossier de données de l'app : jamais un projet à lancer. */
  readonly dataDir: string
  readonly emitOutput: (event: RunOutputEvent) => void
  readonly emitChanged: (view: RunView) => void
  readonly spawnProcess?: typeof spawn
  readonly now?: () => Date
}

/** Sortie gardée par lancement (D4) et rythme d'envoi au renderer. */
export const RUN_LIMITS = { lines: 2_000, flushMs: 80, packageBytes: 512 * 1024 } as const

interface Running {
  view: RunView
  readonly child: ChildProcess
  lines: string[]
  pending: string
  timer: ReturnType<typeof setTimeout> | null
  stopping: boolean
}

const inside = (parent: string, child: string): boolean => {
  const rel = relative(parent.toLowerCase(), child.toLowerCase())
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Lancer un projet (spec 025, constitution 4.6.0) : les scripts du `package.json` d'un projet de confiance, lancés sur
 * clic par `node` + `npm-cli.js` sans shell ; sortie diffusée au renderer par lots et gardée bornée ; arrêt du
 * processus et de ses enfants sur « Arrêter » et à la fermeture de l'app. La confiance d'un projet se donne ici.
 */
export class RunService {
  private readonly runs = new Map<string, Running>()

  constructor(private readonly deps: RunDeps) {}

  scripts(genesisId: string): RunScriptsView {
    const dir = this.dir(genesisId)
    const scripts = this.readScripts(dir)
    const saved = this.deps.favorites.runFavorite(genesisId)
    return {
      trusted: this.deps.isTrusted(projectKey(dir)),
      hasPackage: scripts !== null,
      scripts: scripts ?? [],
      favorite:
        scripts === null
          ? null
          : saved !== null && scripts.some((script) => script.name === saved)
            ? saved
            : defaultFavorite(scripts)
    }
  }

  setFavorite(genesisId: string, script: string): RunScriptsView {
    const view = this.scripts(genesisId)
    if (!view.scripts.some((entry) => entry.name === script)) {
      throw new AppError('UNKNOWN_SCRIPT', `Le script « ${script} » n’existe pas dans package.json.`)
    }
    this.deps.favorites.saveRunFavorite(genesisId, script)
    return { ...view, favorite: script }
  }

  /** Donner ou retirer sa confiance à un projet (spec 014 / 025 D3) : scripts lancés d'un clic, hooks git exécutés. */
  trust(genesisId: string, trusted: boolean): RunScriptsView {
    this.deps.setTrusted(projectKey(this.dir(genesisId)), trusted)
    return this.scripts(genesisId)
  }

  list(): RunView[] {
    return [...this.runs.values()].map((run) => ({ ...run.view, output: run.lines.join('') }))
  }

  start(genesisId: string, script: string): RunView {
    const dir = this.dir(genesisId)
    if (!this.deps.isTrusted(projectKey(dir))) {
      throw new AppError(
        'NOT_TRUSTED',
        'Ce projet n’est pas de confiance : fais-lui confiance pour lancer ses scripts.'
      )
    }
    const scripts = this.readScripts(dir)
    if (scripts === null) throw new AppError('NO_PACKAGE', 'Ce projet n’a pas de package.json lisible.')
    // Nom revalidé contre le package.json relu au moment du lancement (D4).
    if (!scripts.some((entry) => entry.name === script)) {
      throw new AppError('UNKNOWN_SCRIPT', `Le script « ${script} » n’existe pas dans package.json.`)
    }
    const already = [...this.runs.values()].find(
      (run) => run.view.genesisId === genesisId && run.view.script === script && run.view.state === 'running'
    )
    if (already !== undefined) throw new AppError('ALREADY_RUNNING', `« ${script} » tourne déjà pour ce projet.`)
    const npm = this.deps.npm()
    if (npm === null) throw new AppError('NPM_MISSING', 'node ou npm est introuvable : installe Node.js.')

    const child = (this.deps.spawnProcess ?? spawn)(npm.node, [npm.npmCli, 'run', script], {
      cwd: dir,
      shell: false,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '0', NO_UPDATE_NOTIFIER: '1', npm_config_update_notifier: 'false' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const runId = randomUUID()
    const run: Running = {
      view: {
        runId,
        genesisId,
        project: basename(dir),
        script,
        state: 'running',
        exitCode: null,
        startedAt: this.now().toISOString(),
        output: ''
      },
      child,
      lines: [],
      pending: '',
      timer: null,
      stopping: false
    }
    this.runs.set(runId, run)
    const onData = (data: Buffer): void => this.append(run, data.toString('utf8'))
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('error', () => this.end(run, 'failed', null))
    child.on('close', (code) => this.end(run, run.stopping ? 'stopped' : code === 0 ? 'exited' : 'failed', code))
    this.deps.emitChanged(run.view)
    return { ...run.view }
  }

  stop(runId: string): { readonly ok: boolean } {
    const run = this.runs.get(runId)
    if (run === undefined) throw new AppError('NOT_FOUND', 'Ce lancement n’existe plus.')
    if (run.view.state !== 'running') return { ok: false }
    run.stopping = true
    stopTree(run.child)
    return { ok: true }
  }

  /** Retire un onglet terminé. */
  dismiss(runId: string): { readonly ok: true } {
    const run = this.runs.get(runId)
    if (run !== undefined && run.view.state !== 'running') this.runs.delete(runId)
    return { ok: true }
  }

  /** Fermeture de l'app : tout ce qui tourne est arrêté. */
  stopAll(): void {
    for (const run of this.runs.values()) {
      if (run.view.state === 'running') {
        run.stopping = true
        stopTree(run.child)
      }
    }
  }

  private append(run: Running, text: string): void {
    run.pending += text
    if (run.timer !== null) return
    run.timer = setTimeout(() => this.flush(run), RUN_LIMITS.flushMs)
  }

  private flush(run: Running): void {
    if (run.timer !== null) clearTimeout(run.timer)
    run.timer = null
    if (run.pending === '') return
    const chunk = run.pending
    run.pending = ''
    run.lines.push(...chunk.split(/(?<=\n)/))
    if (run.lines.length > RUN_LIMITS.lines) run.lines = run.lines.slice(-RUN_LIMITS.lines)
    this.deps.emitOutput({ runId: run.view.runId, chunk })
  }

  private end(run: Running, state: RunView['state'], code: number | null): void {
    if (run.view.state !== 'running') return
    this.flush(run)
    run.view = { ...run.view, state, exitCode: code }
    this.deps.emitChanged(run.view)
  }

  private dir(genesisId: string): string {
    const stored = this.deps.projectDir(genesisId)
    if (stored === undefined) throw new AppError('NOT_FOUND', 'Projet introuvable.')
    if (stored === null || !existsSync(stored))
      throw new AppError('DIR_MISSING', 'Le dossier du projet est introuvable.')
    const dir = realpathSync(stored)
    const data = realpathSync(this.deps.dataDir)
    if (inside(data, dir) || inside(dir, data)) {
      throw new AppError('NOT_FOUND', 'Ce dossier contient les données de l’app : refusé.')
    }
    return dir
  }

  private readScripts(dir: string): ScriptView[] | null {
    const path = join(dir, 'package.json')
    try {
      if (!existsSync(path) || statSync(path).size > RUN_LIMITS.packageBytes) return null
      return scriptsOf(readFileSync(path, 'utf8'))
    } catch {
      return null
    }
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}
