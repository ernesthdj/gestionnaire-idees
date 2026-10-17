/**
 * Commandes de vérification d'un projet (L2-pipeline-optimal D2, T001) : proposées par l'Architecte dans son contrat,
 * validées par mentalyas, puis lancées par l'app **sans shell** (T002) : un programme et ses arguments, jamais une
 * ligne interprétée. Fonctions pures.
 */

export const CHECK_COMMAND_MAX = 200
export const CHECK_COMMANDS_MAX = 20

/** Ce qu'un shell interpréterait : refusé d'office, la commande ne serait pas ce qu'elle a l'air d'être. */
const SHELL_CHARS = /[|&;<>$`\\\n\r]/

/** Programmes qu'on ne lance pas comme « vérification » : un interpréteur de commandes ouvrirait la porte au shell. */
const SHELLS = new Set(['cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe', 'sh', 'bash', 'zsh'])

export type CheckCommand =
  | { readonly ok: true; readonly program: string; readonly args: readonly string[] }
  | { readonly ok: false; readonly reason: string }

/** Découpe une commande en programme et arguments (guillemets doubles ou simples), ou dit pourquoi elle est refusée. */
export function parseCheckCommand(command: string): CheckCommand {
  const text = command.trim()
  if (text === '') return { ok: false, reason: 'commande vide' }
  if (text.length > CHECK_COMMAND_MAX) return { ok: false, reason: `plus de ${CHECK_COMMAND_MAX} caractères` }
  if (SHELL_CHARS.test(text)) return { ok: false, reason: 'caractère de shell (| & ; < > $ ` \\)' }
  const words: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let started = false
  for (const char of text) {
    if (quote !== null) {
      if (char === quote) quote = null
      else current += char
    } else if (char === '"' || char === "'") {
      quote = char
      started = true
    } else if (/\s/.test(char)) {
      if (started || current !== '') words.push(current)
      current = ''
      started = false
    } else {
      current += char
      started = true
    }
  }
  if (quote !== null) return { ok: false, reason: 'guillemet non fermé' }
  if (started || current !== '') words.push(current)
  const [program, ...args] = words
  if (program === undefined || program === '') return { ok: false, reason: 'programme manquant' }
  if (SHELLS.has(program.toLowerCase()))
    return { ok: false, reason: 'un interpréteur de commandes n’est pas une vérification' }
  return { ok: true, program, args }
}

/** Nouvelles commandes à faire valider : celles qui ne sont pas déjà validées pour ce projet (texte exact). */
export function unvalidated(commands: readonly string[], validated: readonly string[]): string[] {
  const known = new Set(validated.map((command) => command.trim()))
  return commands.map((command) => command.trim()).filter((command) => !known.has(command))
}
