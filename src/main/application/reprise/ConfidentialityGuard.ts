import type { ToolResult } from '@shared/mcp/protocol'
import type { McpToolName } from '@shared/mcp/tools'
import { AppError } from '../../domain/errors'
import type { McpCaller } from '../../domain/mcp/caller'
import { McpToolError } from '../../domain/mcp/errors'

export const LOCAL_ONLY_MESSAGE =
  'Projet repris « Local uniquement » : rien de ce projet n’est transmis à Claude. Change le niveau de ' +
  'confidentialité depuis son badge pour discuter avec Claude.'

export interface ConfidentialityDeps {
  readonly neuron: (id: string) => { readonly rootId: string; readonly genesisId: string | null } | undefined
  readonly project: (genesisId: string) => { readonly confidentiality: 'claude' | 'local' } | undefined
  /** Neurone d'un document (spec 012) ; `undefined` : document inconnu. */
  readonly documentNeuron?: (documentId: string) => string | undefined
}

/**
 * Garde unique de la confidentialité d'un projet repris (spec 017 R5, FR-004) : avant chaque envoi possible à Claude
 * (conversation, tâche, outil du pont MCP), elle remonte au genesis et refuse si le projet est « Local uniquement ».
 * Un neurone hors projet repris est toujours autorisé.
 */
export class ConfidentialityGuard {
  constructor(private readonly deps: ConfidentialityDeps) {}

  isLocalGenesis(genesisId: string): boolean {
    return this.deps.project(genesisId)?.confidentiality === 'local'
  }

  claudeAllowed(neuronId: string): boolean {
    const row = this.deps.neuron(neuronId)
    return row === undefined || !this.isLocalGenesis(row.genesisId ?? row.rootId)
  }

  assertClaudeAllowed(neuronId: string): void {
    if (!this.claudeAllowed(neuronId)) throw new AppError('LOCAL_ONLY', LOCAL_ONLY_MESSAGE)
  }

  /**
   * Outils du pont : refusés si l'appelant ou la cible (`id`, `projet`, `document`) appartient à un projet local —
   * y compris pour une session Claude Code externe, sans neurone. Les vues de la carte sont masquées à part.
   */
  guardTools(
    handle: (tool: McpToolName, args: unknown, caller: McpCaller) => ToolResult | Promise<ToolResult>
  ): (tool: McpToolName, args: unknown, caller: McpCaller) => ToolResult | Promise<ToolResult> {
    return (tool, args, caller) => {
      if (this.targets(args, caller).some((neuronId) => !this.claudeAllowed(neuronId))) {
        throw new McpToolError('NON_MODIFIABLE', LOCAL_ONLY_MESSAGE)
      }
      return handle(tool, args, caller)
    }
  }

  private targets(args: unknown, caller: McpCaller): string[] {
    const ids: string[] = caller.neuronId === null ? [] : [caller.neuronId]
    if (typeof args !== 'object' || args === null) return ids
    const record = args as Record<string, unknown>
    for (const key of ['id', 'projet']) {
      const value = record[key]
      if (typeof value === 'string') ids.push(value)
    }
    const document = record['document']
    if (typeof document === 'string') {
      const owner = this.deps.documentNeuron?.(document)
      if (owner !== undefined) ids.push(owner)
    }
    return ids
  }
}
