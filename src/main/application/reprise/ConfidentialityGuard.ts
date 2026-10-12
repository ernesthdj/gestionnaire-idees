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

  /** Projet repris auquel appartient un neurone (genesis, élément, étape) ; `null` : aucun. */
  projectOf(neuronId: string): { readonly genesisId: string; readonly confidentiality: 'claude' | 'local' } | null {
    const row = this.deps.neuron(neuronId)
    if (row === undefined) return null
    const genesisId = row.genesisId ?? row.rootId
    const project = this.deps.project(genesisId)
    return project === undefined ? null : { genesisId, confidentiality: project.confidentiality }
  }

  claudeAllowed(neuronId: string): boolean {
    return this.projectOf(neuronId)?.confidentiality !== 'local'
  }

  assertClaudeAllowed(neuronId: string): void {
    if (!this.claudeAllowed(neuronId)) throw new AppError('LOCAL_ONLY', LOCAL_ONLY_MESSAGE)
  }

  /**
   * Outils du pont : refusés si l'appelant ou l'un des identifiants des arguments appartient à un projet local —
   * y compris pour une session Claude Code externe, sans neurone. Tous les identifiants comptent, où qu'ils soient
   * (`id`, `projet`, `document`, `element`, `ancre`, `parent`, `source`, extrémités de liens, `ids`, clés `wf:…`) :
   * un champ ajouté à un outil reste gardé sans y penser. Les vues de la carte sont masquées à part.
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
    for (const id of uuidsIn(args)) {
      ids.push(id)
      // Un document (spec 012) appartient au projet de son neurone.
      const owner = this.deps.documentNeuron?.(id)
      if (owner !== undefined) ids.push(owner)
    }
    return ids
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Identifiants contenus dans des arguments déjà validés (objets, tableaux, textes), sans doublon. */
function uuidsIn(value: unknown, found = new Set<string>(), depth = 0): Set<string> {
  if (typeof value === 'string') {
    for (const match of value.matchAll(UUID)) found.add(match[0].toLowerCase())
  } else if (typeof value === 'object' && value !== null && depth < 8) {
    for (const item of Array.isArray(value) ? value : Object.values(value)) uuidsIn(item, found, depth + 1)
  }
  return found
}
