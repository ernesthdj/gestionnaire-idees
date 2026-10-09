import { readFileSync, writeFileSync } from 'node:fs'
import type { RunProcess } from './ClaudeCliProvider'

/**
 * Claude simulé des tests e2e (`--e2e` et `GI_E2E_CLAUDE_REPLY`, jamais dans l'app empaquetée) : aucun processus n'est
 * lancé ; la sortie structurée est lue dans le fichier fictif du test, au moment de l'appel, et la demande reçue est
 * écrite à côté (`<fichier>.request.txt`) pour que le test vérifie ce qui aurait été envoyé à Claude.
 */
export function e2eClaudeRun(replyFile: string): RunProcess {
  return async ({ stdin }) => {
    writeFileSync(`${replyFile}.request.txt`, stdin, 'utf8')
    const structured: unknown = JSON.parse(readFileSync(replyFile, 'utf8'))
    const line = { type: 'result', subtype: 'success', is_error: false, structured_output: structured, usage: {} }
    return { code: 0, stdout: `${JSON.stringify(line)}\n`, stderr: '', timedOut: false }
  }
}
