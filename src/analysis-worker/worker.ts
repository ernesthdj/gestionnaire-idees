import { join } from 'node:path'
import { loadEngine, type Engine } from './engine'
import { processBatch, type WorkerOutput } from './process'
import { WorkerRequest } from './protocol'

/**
 * Processus d'analyse des projets repris (spec 017 R2), lancé par le main avec `utilityProcess.fork` : il lit le code,
 * ne l'exécute jamais, et ne parle qu'au main. Un plantage ici n'emporte ni le main ni l'interface.
 */
const port = process.parentPort
const post = (message: WorkerOutput): void => port.postMessage(message)

let engine: Engine | null = null
let cancelled = false
const queue: unknown[] = []

function handle(data: unknown): void {
  const request = WorkerRequest.safeParse(data)
  if (!request.success) return
  if (request.data.type === 'cancel') {
    cancelled = true
    return
  }
  if (engine === null) {
    queue.push(data)
    return
  }
  cancelled = false
  void processBatch(engine, request.data, post, () => cancelled)
}

port.on('message', (event) => handle(event.data))

void loadEngine(join(import.meta.dirname, 'grammars')).then(
  (loaded) => {
    engine = loaded
    post({ type: 'ready' })
    for (const data of queue.splice(0)) handle(data)
  },
  () => post({ type: 'initError' })
)
