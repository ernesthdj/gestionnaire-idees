import { mkdirSync, watch, type FSWatcher } from 'node:fs'

const DEBOUNCE_MS = 1000

/**
 * Surveille le dossier d'import : Claude Code écrit `manifest.json` en dernier, on attend donc qu'il
 * apparaisse, puis une seconde de calme, avant d'examiner le paquet.
 */
export function watchInbox(directory: string, onManifest: () => void): () => void {
  mkdirSync(directory, { recursive: true })
  let timer: NodeJS.Timeout | undefined
  const watcher: FSWatcher = watch(directory, (_event, filename) => {
    if (filename !== 'manifest.json') return
    clearTimeout(timer)
    timer = setTimeout(onManifest, DEBOUNCE_MS)
  })
  return () => {
    clearTimeout(timer)
    watcher.close()
  }
}
