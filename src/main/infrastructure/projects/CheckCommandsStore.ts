import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { CHECK_COMMANDS_MAX, CHECK_COMMAND_MAX, parseCheckCommand } from '@shared/agents/checks'

const UUID = /^[0-9a-f-]{36}$/i

/** Fichier relu à chaque fois (il vit hors de l'app) : une commande qui ne passe plus la garde est écartée. */
const Stored = z.object({
  commands: z.array(z.string().max(CHECK_COMMAND_MAX)).max(CHECK_COMMANDS_MAX * 5),
  validatedAt: z.number().finite()
})

/**
 * Commandes de vérification validées par mentalyas, par projet (L2-pipeline-optimal D2, T001) : une commande validée
 * n'est pas redemandée tant qu'elle ne change pas. Un fichier JSON par genesis, dans le profil (hors du dépôt).
 */
export class CheckCommandsStore {
  constructor(
    private readonly dir: string,
    private readonly now: () => number = Date.now
  ) {}

  validated(genesisId: string): string[] {
    const file = this.fileOf(genesisId)
    if (file === undefined || !existsSync(file)) return []
    try {
      const parsed = Stored.safeParse(JSON.parse(readFileSync(file, 'utf8')))
      return parsed.success ? parsed.data.commands.filter((command) => parseCheckCommand(command).ok) : []
    } catch {
      return []
    }
  }

  /** Ajoute des commandes validées (sans doublon) ; une commande refusée par la garde n'est jamais gardée. */
  save(genesisId: string, commands: readonly string[]): void {
    const file = this.fileOf(genesisId)
    if (file === undefined) return
    const kept = [...new Set([...this.validated(genesisId), ...commands.map((command) => command.trim())])]
      .filter((command) => parseCheckCommand(command).ok)
      .slice(-CHECK_COMMANDS_MAX * 5)
    mkdirSync(this.dir, { recursive: true })
    writeFileSync(file, `${JSON.stringify({ commands: kept, validatedAt: this.now() }, null, 2)}\n`, 'utf8')
  }

  private fileOf(genesisId: string): string | undefined {
    return UUID.test(genesisId) ? join(this.dir, `${genesisId}.json`) : undefined
  }
}
