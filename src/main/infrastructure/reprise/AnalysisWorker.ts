import { utilityProcess } from 'electron'
import type { RunWorker } from '../../application/reprise/AnalysisService'

/** Une annulation qui n'aboutit pas dans ce délai arrête le processus. */
const CANCEL_GRACE_MS = 5000

/**
 * Lance le processus d'analyse (spec 017 R2) : un `utilityProcess` par analyse, code de l'app (jamais un programme
 * du projet), sans console ; arrêté dès qu'il a fini, ou s'il ne répond plus à une annulation.
 */
export function analysisWorker(workerPath: string): RunWorker {
  return (request, onMessage, onExit) => {
    const child = utilityProcess.fork(workerPath, [], { serviceName: 'Analyse des projets repris', stdio: 'ignore' })
    let ended = false
    child.on('message', (message: unknown) => {
      onMessage(message)
      const type = typeof message === 'object' && message !== null ? (message as { type?: unknown }).type : undefined
      if (type === 'done' || type === 'initError') {
        ended = true
        child.kill()
      }
    })
    child.on('exit', () => {
      if (!ended) onExit()
    })
    child.postMessage(request)
    return {
      cancel: () => {
        child.postMessage({ type: 'cancel' })
        setTimeout(() => {
          if (!ended) child.kill()
        }, CANCEL_GRACE_MS).unref()
      }
    }
  }
}
