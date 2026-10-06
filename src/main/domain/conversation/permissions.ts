import type { PermissionDetailView } from '@shared/ipc/chat'

/**
 * Permissions des conversations (spec 014 research R3) : décrire une demande de Claude Code et savoir si une règle
 * « Toujours pour ce projet » la couvre. Fonctions pures ; les règles sont gardées par l'app, jamais dans le dépôt.
 */

/** Outils qui écrivent un fichier : une règle « Toujours » couvre l'outil sur tout le projet. */
export const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'] as const
/** Outils qui lancent une commande : une règle « Toujours » couvre la commande exacte seulement. */
export const COMMAND_TOOLS = ['Bash', 'PowerShell'] as const

export interface PermissionRule {
  readonly tool: string
  /** Commande exacte pour un outil de commande ; `null` : tout l'outil. */
  readonly pattern: string | null
}

/** Ce qu'une demande montre à mentalyas (jamais journalisé). */
export type PermissionDetail = PermissionDetailView

const PREVIEW_MAX = 4000

const isWrite = (tool: string): boolean => (WRITE_TOOLS as readonly string[]).includes(tool)
const isCommand = (tool: string): boolean => (COMMAND_TOOLS as readonly string[]).includes(tool)
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const clip = (value: string): string => (value.length <= PREVIEW_MAX ? value : `${value.slice(0, PREVIEW_MAX)}…`)

/** Clé d'un projet : chemin réel, séparateurs unifiés, en minuscules (Windows ne distingue pas la casse). */
export function projectKey(realPath: string): string {
  return realPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/** Commande d'une demande d'outil de commande, telle que Claude Code la lancera. */
function commandOf(input: Readonly<Record<string, unknown>>): string {
  return text(input['command']).trim()
}

/** Ce qui va se passer, lisible : chemin et aperçu du changement, ou commande exacte. */
export function describeRequest(tool: string, input: Readonly<Record<string, unknown>>): PermissionDetail {
  if (isCommand(tool)) {
    const cwd = text(input['cwd'])
    return { kind: 'command', command: commandOf(input), cwd: cwd === '' ? null : cwd }
  }
  if (isWrite(tool)) {
    const path = text(input['file_path']) || text(input['notebook_path'])
    const edits = Array.isArray(input['edits']) ? (input['edits'] as unknown[]) : []
    const preview =
      tool === 'Write'
        ? text(input['content'])
        : tool === 'Edit'
          ? `− ${text(input['old_string'])}\n+ ${text(input['new_string'])}`
          : tool === 'MultiEdit'
            ? edits
                .map((edit) => {
                  const entry = typeof edit === 'object' && edit !== null ? (edit as Record<string, unknown>) : {}
                  return `− ${text(entry['old_string'])}\n+ ${text(entry['new_string'])}`
                })
                .join('\n\n')
            : text(input['new_source'])
    return { kind: 'write', path, preview: clip(preview) }
  }
  return { kind: 'other', input: clip(JSON.stringify(input)) }
}

/** Règle créée par « Toujours pour ce projet » à partir d'une demande. */
export function ruleFor(tool: string, input: Readonly<Record<string, unknown>>): PermissionRule {
  return { tool, pattern: isCommand(tool) ? commandOf(input) : null }
}

/** Une règle couvre-t-elle cette demande ? Commande : texte identique (une commande vide n'est jamais couverte). */
export function ruleMatches(rule: PermissionRule, tool: string, input: Readonly<Record<string, unknown>>): boolean {
  if (rule.tool !== tool) return false
  if (!isCommand(tool)) return rule.pattern === null
  const command = commandOf(input)
  return command !== '' && rule.pattern === command
}
