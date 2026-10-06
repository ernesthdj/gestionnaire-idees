import { join } from 'node:path'
import { loadEngine } from './engine'

/**
 * Processus d'analyse des projets repris (spec 017 R2), lancé par le main avec `utilityProcess.fork` : il lit le code,
 * ne l'exécute jamais, et ne parle qu'au main. Un plantage ici n'emporte ni le main ni l'interface.
 */
const port = process.parentPort

void loadEngine(join(import.meta.dirname, 'grammars')).then(
  () => port.postMessage({ type: 'ready' }),
  () => port.postMessage({ type: 'initError' })
)
