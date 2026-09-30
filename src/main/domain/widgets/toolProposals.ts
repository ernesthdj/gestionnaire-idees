import type { ToolProposal } from '@shared/ai/neurons'

/** Widget déjà branché sur une idée, rappelé à Claude pour qu'il ne le repropose pas (spec 006 FR-011). */
export interface ExistingTool {
  readonly title: string
  readonly summary: string
}

const key = (title: string): string => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')

/**
 * Propositions retenues (FR-011) : ni un outil déjà branché sur l'idée, ni deux fois le même titre dans la réponse
 * (casse et espaces ignorés).
 */
export function keepNewTools(tools: readonly ToolProposal[], existing: readonly ExistingTool[]): ToolProposal[] {
  const seen = new Set(existing.map((tool) => key(tool.title)))
  return tools.filter((tool) => {
    const id = key(tool.title)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/** Verdict affiché quand l'application a retiré toutes les propositions de Claude (déjà branchées). */
export const ALREADY_CONNECTED_NOTE = 'Les outils que Claude voyait sont déjà branchés sur cette idée.'

/**
 * Outils d'une sortie de synthèse une fois filtrés (FR-011, FR-013) : aucun sans Claude (le verdict est alors
 * laissé vide, l'interface explique le mode dégradé) ; si le filtre retire tout, le verdict le dit.
 */
export function settleTools<T extends { readonly tools: ToolProposal[]; readonly toolsNote: string }>(
  data: T,
  options: { readonly degraded: boolean; readonly existing: readonly ExistingTool[] }
): T {
  if (options.degraded) return { ...data, tools: [], toolsNote: '' }
  const tools = keepNewTools(data.tools, options.existing)
  const toolsNote = tools.length === 0 && data.tools.length > 0 ? ALREADY_CONNECTED_NOTE : data.toolsNote
  return { ...data, tools, toolsNote }
}

/**
 * Demande de génération d'un outil coché (spec 006 FR-007) : la proposition seule. Aucune valeur de l'idée : le
 * service de widgets y joint la STRUCTURE des entrées branchées, et le widget lira les valeurs après la revue.
 */
export function toolRequestText(request: {
  readonly title: string
  readonly description: string
  readonly producesResult: boolean
}): string {
  return [
    `Outil proposé à l’éclosion de l’idée : « ${request.title} ». ${request.description}`,
    'Il lit l’idée branchée sur lui (structure ci-dessus quand il y en a une).',
    request.producesResult ? 'Publie son résultat avec window.gi.output.' : null
  ]
    .filter((part) => part !== null)
    .join(' ')
}
