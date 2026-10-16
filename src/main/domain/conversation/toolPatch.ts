import { z } from 'zod'
import type { ToolPatch, ToolPatchHunk } from '@shared/ipc/chat'

/** Bornes d'une modification gardée pour la fenêtre d'une pastille (spec 014 D9) : au-delà, le diff est coupé. */
export const TOOL_PATCH_MAX_LINES = 3_000
export const TOOL_PATCH_MAX_CHARS = 300_000

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const HunkSchema = z.object({
  oldStart: z.number().int().nonnegative(),
  newStart: z.number().int().nonnegative(),
  lines: z.array(z.string())
})

/** Garde les premiers blocs jusqu'aux bornes ; un bloc entamé est coupé à la ligne. */
function bounded(hunks: readonly ToolPatchHunk[], created: boolean): ToolPatch {
  const kept: ToolPatchHunk[] = []
  let lines = 0
  let chars = 0
  for (const hunk of hunks) {
    const room: string[] = []
    for (const line of hunk.lines) {
      if (lines >= TOOL_PATCH_MAX_LINES || chars + line.length > TOOL_PATCH_MAX_CHARS) {
        if (room.length > 0) kept.push({ ...hunk, lines: room })
        return { hunks: kept, created, truncated: true }
      }
      room.push(line)
      lines += 1
      chars += line.length
    }
    kept.push({ ...hunk, lines: room })
  }
  return { hunks: kept, created, truncated: false }
}

/**
 * Modification d'un outil lue dans le `tool_use_result` du CLI (sonde du 2026-10-16) : `structuredPatch` pour un
 * Edit ou un Write qui remplace ; pour un Write qui crée, tout le contenu en lignes ajoutées. `null` : rien à montrer
 * (une lecture, un résultat inattendu). Rien n'est interprété : ce sont des lignes de texte.
 */
export function toolPatchOf(result: unknown): ToolPatch | null {
  if (!isObject(result)) return null
  const structured = z.array(HunkSchema).safeParse(result['structuredPatch'])
  if (structured.success && structured.data.length > 0) return bounded(structured.data, false)
  if (result['type'] === 'create' && typeof result['content'] === 'string') {
    const lines = result['content'].replace(/\r\n/g, '\n').split('\n')
    if (lines.at(-1) === '') lines.pop()
    return bounded([{ oldStart: 0, newStart: 1, lines: lines.map((line) => `+${line}`) }], true)
  }
  return null
}

const PatchSchema = z.object({ hunks: z.array(HunkSchema), created: z.boolean(), truncated: z.boolean() })

/** Relecture d'une modification enregistrée ; `null` si le JSON est illisible (jamais d'exception). */
export function readToolPatch(json: string | null): ToolPatch | null {
  if (json === null) return null
  try {
    const parsed = PatchSchema.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
