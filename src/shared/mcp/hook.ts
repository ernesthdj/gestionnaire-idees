import { EcritureAvantInput } from './tools'

/** Outils d'écriture de Claude Code surveillés par le hook `PreToolUse` de l'app (spec 014 R5). */
export const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'] as const

/** Entrée standard du hook `PreToolUse` (Claude Code 2.1.291) → ce que le main doit savoir ; `null` sinon. */
export function parseHookInput(text: string): EcritureAvantInput | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const toolInput = record['tool_input']
  const input = typeof toolInput === 'object' && toolInput !== null ? (toolInput as Record<string, unknown>) : {}
  // NotebookEdit nomme son fichier `notebook_path` ; les autres outils, `file_path`.
  const parsed = EcritureAvantInput.safeParse({
    tool: record['tool_name'],
    file_path: input['file_path'] ?? input['notebook_path'],
    tool_use_id: record['tool_use_id']
  })
  return parsed.success && (WRITE_TOOLS as readonly string[]).includes(parsed.data.tool) ? parsed.data : null
}
