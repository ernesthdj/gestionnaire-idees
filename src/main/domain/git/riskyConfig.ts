/**
 * Configuration locale à risque d'un dépôt (spec 021 research R3) : des clés de `.git/config` peuvent faire exécuter un
 * programme dès un `git status` (filtre `clean`) ou un `fetch` (`core.sshCommand`). Deux classes :
 * - **neutralisées** par le préfixe sûr (`gitPrefix`) : simple mention ;
 * - **non neutralisables** : dans un dépôt non de confiance, aucune autre commande git n'est lancée.
 * Les noms arrivent en minuscules (`parseConfigNames`). Pur.
 */

const NEUTRALIZED_EXACT = new Set([
  'core.fsmonitor',
  'core.hookspath',
  'core.pager',
  'core.editor',
  'diff.external',
  'sequence.editor'
])
const NEUTRALIZED_PATTERNS = [/^diff\..+\.textconv$/]

const BLOCKING_EXACT = new Set(['include.path', 'core.sshcommand', 'credential.helper', 'gpg.program', 'core.gitproxy'])
const BLOCKING_PATTERNS = [
  /^filter\..+\.(clean|smudge|process|required)$/,
  /^includeif\..+\.path$/,
  /^merge\..+\.driver$/,
  /^diff\..+\.command$/,
  /^uploadpack\./,
  /^remote\..+\.(uploadpack|receivepack)$/,
  /^credential\..+\.helper$/,
  /^gpg\..+\.program$/
]

export interface RiskyConfig {
  /** Clés non neutralisables : un dépôt non de confiance passe en mode « configuration à risque ». */
  readonly blocking: readonly string[]
  /** Clés neutralisées par le préfixe : mentionnées seulement. */
  readonly neutralized: readonly string[]
}

export function classifyConfig(names: readonly string[]): RiskyConfig {
  const blocking: string[] = []
  const neutralized: string[] = []
  for (const raw of names) {
    const name = raw.toLowerCase()
    if (BLOCKING_EXACT.has(name) || BLOCKING_PATTERNS.some((pattern) => pattern.test(name))) blocking.push(name)
    else if (NEUTRALIZED_EXACT.has(name) || NEUTRALIZED_PATTERNS.some((pattern) => pattern.test(name))) {
      neutralized.push(name)
    }
  }
  return { blocking: [...new Set(blocking)], neutralized: [...new Set(neutralized)] }
}
