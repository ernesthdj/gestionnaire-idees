import type { ToolProposal } from '@shared/ai/neurons'

/** Widget déjà branché sur une idée, rappelé à Claude pour qu'il ne le repropose pas (spec 006 FR-011). */
export interface ExistingTool {
  readonly title: string
  readonly summary: string
}

const key = (title: string): string => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')

/**
 * Propositions retenues (FR-011) : ni un outil déjà branché sur l'idée, ni deux fois le même titre dans la réponse
 * (casse et espaces ignorés). `undefined` s'il ne reste rien : la synthèse n'a alors pas de champ `tools`.
 */
export function keepNewTools(
  tools: readonly ToolProposal[] | undefined,
  existing: readonly ExistingTool[]
): ToolProposal[] | undefined {
  const seen = new Set(existing.map((tool) => key(tool.title)))
  const kept = (tools ?? []).filter((tool) => {
    const id = key(tool.title)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  return kept.length === 0 ? undefined : kept
}

/** Remplace le champ `tools` d'une sortie de synthèse (retiré s'il ne reste rien). */
export function withTools<T extends { readonly tools?: ToolProposal[] | undefined }>(
  data: T,
  tools: ToolProposal[] | undefined
): T {
  const copy: Record<string, unknown> = { ...data }
  delete copy['tools']
  return (tools === undefined ? copy : { ...copy, tools }) as T
}
