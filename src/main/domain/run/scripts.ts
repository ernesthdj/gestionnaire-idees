import { z } from 'zod'

/** Nom de script npm accepté (spec 025 FR-001). */
export const SCRIPT_NAME = /^[A-Za-z0-9:._-]{1,100}$/
export const MAX_SCRIPTS = 50

const PackageJson = z.looseObject({ scripts: z.record(z.string(), z.unknown()).optional() })

export interface ScriptView {
  readonly name: string
  /** Commande du script, affichée telle quelle (bornée). */
  readonly command: string
}

/** Scripts d'un `package.json` (texte) ; `null` s'il est illisible. Seuls les noms sûrs et les commandes texte. Pur. */
export function scriptsOf(text: string): ScriptView[] | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = PackageJson.safeParse(json)
  if (!parsed.success) return null
  return Object.entries(parsed.data.scripts ?? {})
    .filter(([name, command]) => SCRIPT_NAME.test(name) && typeof command === 'string')
    .slice(0, MAX_SCRIPTS)
    .map(([name, command]) => ({ name, command: String(command).slice(0, 500) }))
}

/** Favori par défaut : `dev`, sinon `start`, sinon `serve`, sinon le premier. */
export function defaultFavorite(scripts: readonly ScriptView[]): string | null {
  for (const preferred of ['dev', 'start', 'serve'])
    if (scripts.some((script) => script.name === preferred)) return preferred
  return scripts[0]?.name ?? null
}
