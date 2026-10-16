import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentDir } from '../../application/mcp/AgentTools'

/** Un fichier d'agent plus gros est illisible (un sous-agent de Claude Code tient en quelques Ko). */
const AGENT_FILE_MAX = 200_000

/**
 * Agents en fichiers de Claude Code (L2-agents-lire.md) : les `.md` d'un dossier `agents/`, sans descendre dans les
 * sous-dossiers ni suivre de chemin donné par Claude. `null` si le dossier n'existe pas ; un fichier trop gros ou
 * illisible rend `text: null`.
 */
export function readAgentDir(dir: string): AgentDir {
  if (!existsSync(dir)) return null
  let names: string[]
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return null
  }
  return names.map((file) => {
    try {
      const path = join(dir, file)
      return { file, text: statSync(path).size > AGENT_FILE_MAX ? null : readFileSync(path, 'utf8') }
    } catch {
      return { file, text: null }
    }
  })
}
