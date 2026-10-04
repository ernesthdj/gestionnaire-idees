import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

/**
 * Point de rendez-vous du relais et du main (spec 007 research R3), partagé par les deux processus Node.
 */

/** Fichier du secret du pont, dans le dossier du profil (`%APPDATA%/gestionnaire-idees` ou le profil démo). */
export const MCP_TOKEN_FILE = 'mcp.token'

/** Nom du canal nommé propre à un profil : le profil réel et le profil démo ne se croisent jamais. */
export function pipeNameFor(profileDir: string): string {
  // Chemin normalisé (séparateurs, casse) : `C:/…` et `C:\…` désignent le même profil, donc le même canal.
  const digest = createHash('sha256').update(resolve(profileDir).toLowerCase()).digest('hex').slice(0, 8)
  return `\\\\.\\pipe\\gestionnaire-idees-mcp-${digest}`
}

export function tokenPathFor(profileDir: string): string {
  return join(profileDir, MCP_TOKEN_FILE)
}
