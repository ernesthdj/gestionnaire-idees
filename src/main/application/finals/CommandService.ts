import { randomUUID } from 'node:crypto'
import type { ProjectCommandsView } from '@shared/ipc/finals'
import { AppError } from '../../domain/errors'
import { COMMAND_LIMITS, readScripts, SCRIPT_NAME, type PackageScripts } from '../../domain/finals/commands'
import type { CommandRepository } from '../../infrastructure/db/repositories/CommandRepository'
import type { FinalRepository } from '../../infrastructure/db/repositories/FinalRepository'
import type { CommandResult } from '../../infrastructure/finals/CommandRunner'
import type { ProjectFiles } from '../../infrastructure/finals/ProjectFiles'

export interface CommandRunView extends CommandResult {
  readonly script: string
}

export interface CommandDeps {
  readonly commands: Pick<CommandRepository, 'approved' | 'replaceApproved' | 'insertRun'>
  readonly finals: Pick<FinalRepository, 'openOf' | 'get' | 'addEvent'>
  readonly projectDir: (genesisId: string) => string | null
  readonly files: Pick<ProjectFiles, 'read'>
  /** Lance `npm run <script>` dans le dossier du projet (sans shell, délai borné). */
  readonly run: (cwd: string, script: string) => Promise<CommandResult>
  readonly emit: (neuronId: string) => void
  readonly now?: () => Date
}

/**
 * Scripts approuvés d'un projet (spec 013 D2 bis) : mentalyas choisit, dans `package.json`, ce que Claude peut lancer ;
 * pendant une exécution seulement, Claude lance un script approuvé dont le texte n'a pas changé, un à la fois.
 */
export class CommandService {
  private readonly running = new Set<string>()

  constructor(private readonly deps: CommandDeps) {}

  list(genesisId: string): ProjectCommandsView {
    const projectDir = this.deps.projectDir(genesisId)
    if (projectDir === null) return { linked: false, packageJson: false, scripts: [] }
    const scripts = this.scriptsOf(projectDir)
    if (scripts === null) return { linked: true, packageJson: false, scripts: [] }
    const approved = new Map(this.deps.commands.approved(genesisId).map((row) => [row.script, row] as const))
    return {
      linked: true,
      packageJson: true,
      scripts: [...scripts].map(([name, text]) => {
        const row = approved.get(name)
        return { name, text, approved: row !== undefined, changed: row !== undefined && row.scriptText !== text }
      })
    }
  }

  /** Scripts lançables (approuvés, texte inchangé) : annoncés à Claude dans le dossier d'exécution. */
  runnable(genesisId: string): string[] {
    return this.list(genesisId)
      .scripts.filter((script) => script.approved && !script.changed)
      .map((script) => script.name)
  }

  /** Remplace la liste approuvée ; retient le texte ACTUEL de chaque script. */
  approve(genesisId: string, names: readonly string[]): void {
    const projectDir = this.deps.projectDir(genesisId)
    if (projectDir === null) throw new AppError('VALIDATION', 'Aucun dossier de projet lié à ce genesis.')
    if (names.length > COMMAND_LIMITS.approved) {
      throw new AppError('VALIDATION', `Au plus ${COMMAND_LIMITS.approved} scripts approuvés.`)
    }
    const scripts = this.scriptsOf(projectDir)
    if (scripts === null) throw new AppError('VALIDATION', 'Le projet n’a pas de package.json lisible.')
    const now = this.now()
    const rows = [...new Set(names)].map((name) => {
      const text = scripts.get(name)
      if (text === undefined) throw new AppError('VALIDATION', `Script « ${name} » absent du package.json.`)
      return { script: name, scriptText: text, approvedAt: now }
    })
    this.deps.commands.replaceApproved(genesisId, rows)
  }

  /** `commande_lancer` : pendant l'exécution de la conversation appelante seulement. */
  async run(callerNeuronId: string | null, script: string): Promise<CommandRunView> {
    const open = callerNeuronId === null ? undefined : this.deps.finals.openOf(callerNeuronId)
    if (open === undefined) {
      throw new AppError(
        'INVALID_STATE',
        'Aucune exécution en cours pour cette conversation : aucune commande possible.'
      )
    }
    const refuse = (message: string, code = 'INVALID_STATE'): never => {
      this.deps.finals.addEvent({
        executionId: open.id,
        at: this.now(),
        kind: 'refus',
        path: null,
        detail: `${script.slice(0, 40)} : ${message}`
      })
      this.deps.emit(open.neuronId)
      throw new AppError(code, message)
    }
    if (!SCRIPT_NAME.test(script)) return refuse('nom de script invalide.', 'VALIDATION')
    const genesisId = this.deps.finals.get(open.neuronId)?.genesisId ?? ''
    const projectDir = this.deps.projectDir(genesisId)
    if (projectDir === null) return refuse('aucun dossier de projet lié.')
    if (this.running.has(open.id)) return refuse('une commande est déjà en cours : attends son résultat.')
    const text = this.scriptsOf(projectDir)?.get(script)
    if (text === undefined) return refuse(`« ${script} » est absent du package.json du projet.`)
    const approval = this.deps.commands.approved(genesisId).find((row) => row.script === script)
    if (approval === undefined) {
      return refuse(
        `« ${script} » n’est pas approuvé : mentalyas l’approuve dans le volet de l’action (⚡ › Commandes), ` +
          'ou lance-le lui-même.'
      )
    }
    if (approval.scriptText !== text) {
      return refuse(`le texte de « ${script} » a changé depuis son approbation : mentalyas doit le réapprouver.`)
    }

    this.running.add(open.id)
    try {
      const result = await this.deps.run(projectDir, script)
      const at = this.now()
      this.deps.commands.insertRun({ id: randomUUID(), executionId: open.id, script, ...result, at })
      const outcome = result.timedOut
        ? 'délai dépassé'
        : result.exitCode === null
          ? 'lancement impossible'
          : `code ${result.exitCode}`
      this.deps.finals.addEvent({
        executionId: open.id,
        at,
        kind: 'commande',
        path: null,
        detail: `npm run ${script} → ${outcome} (${Math.round(result.durationMs / 1000)} s)`
      })
      this.deps.emit(open.neuronId)
      return { script, ...result }
    } finally {
      this.running.delete(open.id)
    }
  }

  private scriptsOf(projectDir: string): PackageScripts | null {
    try {
      const file = this.deps.files.read(projectDir, 'package.json')
      return file === null ? null : readScripts(file.content)
    } catch {
      return null
    }
  }

  private now(): string {
    return (this.deps.now?.() ?? new Date()).toISOString()
  }
}
