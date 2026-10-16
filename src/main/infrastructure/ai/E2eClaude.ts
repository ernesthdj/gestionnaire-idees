import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SpawnConversation } from '../claude/CliConversation'
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

/**
 * Sessions d'agents simulées des tests e2e (T006) : le « travail » dure `delayMs` (assez pour voir l'agent au travail
 * sur la carte), s'arrête à l'annulation, puis rend un rapport qui finit par un verdict de QA valide. Aucun processus
 * n'est lancé.
 */
export function e2eAgentRun(delayMs = 1500): RunProcess {
  return async ({ signal, cwd, args, onStdoutLine }) => {
    // Ce que l'agent « fait » (L1o D18) : il écrit un fichier de son worktree, annoncé dans le flux comme un vrai outil.
    const sessionId = args[args.indexOf('--session-id') + 1] ?? 'e2e'
    const file = join(cwd, 'agents-e2e', `${sessionId}.md`)
    const emit = (value: unknown): void => onStdoutLine?.(JSON.stringify(value))
    emit({ type: 'system', subtype: 'init', session_id: sessionId, model: 'e2e', apiKeySource: 'none' })
    emit({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', id: `w-${sessionId}`, name: 'Write', input: { file_path: file, content: 'x' } }]
      }
    })
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `Travail simulé de la session ${sessionId}.\n`, 'utf8')
    emit({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: `w-${sessionId}`, content: 'ok' }] }
    })
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delayMs)
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true }
      )
    })
    const result = 'Rapport simulé de l’agent (e2e).\n\nVERDICT: VALIDE'
    const line = { type: 'result', subtype: 'success', is_error: false, result }
    return { code: 0, stdout: `${JSON.stringify(line)}\n`, stderr: '', timedOut: false }
  }
}

/**
 * Conversation simulée des tests e2e (visio d'un agent, L1o D13) : chaque message reçoit une réponse fixe, envoyée mot
 * par mot (assez lentement pour voir l'agent parler et les sous-titres défiler), puis la fin du tour. Aucun processus.
 */
export function e2eConversationSpawn(stepMs = 60): SpawnConversation {
  return (options) => {
    let killed = false
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const later = (ms: number, fn: () => void): void => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        if (!killed) fn()
      }, ms)
      timers.add(timer)
    }
    const emit = (value: unknown): void => options.onLine(JSON.stringify(value))
    const sessionId = options.args[options.args.indexOf('--session-id') + 1] ?? 'e2e'
    later(0, () => emit({ type: 'system', subtype: 'init', session_id: sessionId, model: 'e2e', apiKeySource: 'none' }))
    return {
      write: () => {
        const words = E2E_CHAT_REPLY.split(' ')
        words.forEach((word, index) =>
          later(stepMs * (index + 1), () =>
            emit({
              type: 'stream_event',
              event: {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: `${index === 0 ? '' : ' '}${word}` }
              }
            })
          )
        )
        later(stepMs * (words.length + 2), () =>
          emit({
            type: 'result',
            subtype: 'success',
            is_error: false,
            result: E2E_CHAT_REPLY,
            session_id: sessionId,
            usage: {}
          })
        )
      },
      kill: () => {
        killed = true
        for (const timer of timers) clearTimeout(timer)
        timers.clear()
        options.onExit(null, '')
      }
    }
  }
}

/** Réponse de la conversation simulée. */
export const E2E_CHAT_REPLY =
  'Salut ! Je suis sur le tri par date : le test passe, il me reste à relire le diff avant de te le montrer.'
