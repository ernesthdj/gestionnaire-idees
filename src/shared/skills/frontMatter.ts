import { z } from 'zod'

/**
 * En-tête d'un `SKILL.md` (spec 020 research R2) : bloc `---` initial lu par un analyseur maison, sans aucune
 * exécution. Seules des lignes `clé: valeur` sont comprises, valeurs simples ou entre guillemets (échappements `\"`,
 * `\\`, `\n` dans les guillemets doubles) ; les clés `name`, `description` et `trigger` sont gardées, tout le reste est
 * ignoré (listes, ancres, balises, types). Fonction pure.
 */

export const SkillHeader = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(2000),
  trigger: z.string().trim().max(1000).optional()
})
export type SkillHeader = z.infer<typeof SkillHeader>

export interface ParsedSkill {
  /** En-tête valide, ou `null` (absent, mal formé, champ manquant) : le skill est alors « abîmé ». */
  readonly header: SkillHeader | null
  /** Corps du fichier, sans l'en-tête. */
  readonly body: string
}

const KEPT = new Set(['name', 'description', 'trigger'])

function unquote(raw: string): string | null {
  const value = raw.trim()
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) return null
    let out = ''
    const inner = value.slice(1, -1)
    for (let i = 0; i < inner.length; i += 1) {
      const char = inner[i] as string
      if (char !== '\\') {
        if (char === '"') return null
        out += char
        continue
      }
      const next = inner[i + 1]
      if (next === '"' || next === '\\') out += next
      else if (next === 'n') out += '\n'
      else return null
      i += 1
    }
    return out
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) return null
    return value.slice(1, -1).replace(/''/g, "'")
  }
  // Valeur simple : un commentaire ` #` en fin de ligne est retiré.
  const comment = value.search(/\s#/)
  return comment === -1 ? value : value.slice(0, comment).trimEnd()
}

export function parseSkillMarkdown(text: string): ParsedSkill {
  const source = text.replace(/^\uFEFF/, '')
  const lines = source.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { header: null, body: source }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (end === -1) return { header: null, body: source }
  const fields: Record<string, string> = {}
  let broken = false
  for (const line of lines.slice(1, end)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    // Continuation, liste ou bloc : ignorés (seules les lignes de premier niveau comptent).
    if (/^\s/.test(line) || line.startsWith('-')) continue
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/.exec(line)
    if (match === null) continue
    const key = (match[1] as string).toLowerCase()
    if (!KEPT.has(key)) continue
    const value = unquote(match[2] as string)
    if (value === null) {
      broken = true
      continue
    }
    fields[key] = value
  }
  const body = lines.slice(end + 1).join('\n')
  if (broken) return { header: null, body }
  const parsed = SkillHeader.safeParse(fields)
  return { header: parsed.success ? parsed.data : null, body }
}
