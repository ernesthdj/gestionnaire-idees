/**
 * Scripts d'un projet lancés par Claude pendant une exécution (spec 013 D2 bis, R9) : lecture des scripts de
 * `package.json`, nom de script sûr, sortie bornée et lisible. Fonctions pures.
 */

/** Nom d'un script npm acceptable : jamais un caractère qu'un interpréteur pourrait lire autrement. */
export const SCRIPT_NAME = /^[A-Za-z0-9:_.-]{1,40}$/
export const SCRIPT_TEXT_MAX = 2000
export const COMMAND_LIMITS = { timeoutMs: 5 * 60_000, outputChars: 20_000, approved: 20 } as const

export type PackageScripts = ReadonlyMap<string, string>

/** Scripts lisibles d'un `package.json` ; `null` si le fichier n'est pas un JSON objet. Les entrées douteuses sont ignorées. */
export function readScripts(packageJson: string): PackageScripts | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(packageJson)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const raw = (parsed as Record<string, unknown>)['scripts']
  const scripts = new Map<string, string>()
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return scripts
  for (const [name, text] of Object.entries(raw as Record<string, unknown>)) {
    if (!SCRIPT_NAME.test(name) || typeof text !== 'string' || text.length > SCRIPT_TEXT_MAX) continue
    scripts.set(name, text)
  }
  return scripts
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007/g

/** Sortie rendue à Claude et gardée au livrable : sans codes de couleur, fins de ligne unifiées, fin conservée. */
export function tailOutput(raw: string, max: number = COMMAND_LIMITS.outputChars): string {
  const clean = raw.replace(ANSI, '').replace(/\r\n?/g, '\n')
  return clean.length <= max ? clean : `… [${clean.length - max} caractères plus haut]\n${clean.slice(-max)}`
}
