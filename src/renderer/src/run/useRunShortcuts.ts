import { useEffect } from 'react'
import type { RunScriptsView } from '@shared/run/run'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'
import { useRuns } from './runStore'

/**
 * Raccourcis du lancement (spec 025 D5) : F5 lance le script favori du projet ouvert (s'il tourne déjà, l'app le dit) ;
 * Maj+F5 l'arrête.
 */
export function useRunShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'F5' || event.ctrlKey || event.altKey || event.metaKey) return
      const genesisId = useUiStore.getState().brainstorm?.genesisId ?? null
      if (genesisId === null) return
      event.preventDefault()
      void (async () => {
        const ui = useUiStore.getState()
        try {
          const view = await call<RunScriptsView>('run:scripts', { genesisId })
          const favorite = view.favorite
          if (favorite === null) {
            ui.showToast('Ce projet n’a pas de script npm à lancer.')
            return
          }
          const running = useRuns
            .getState()
            .runs.find((run) => run.genesisId === genesisId && run.script === favorite && run.state === 'running')
          if (event.shiftKey) {
            if (running === undefined) ui.showToast(`« ${favorite} » ne tourne pas.`)
            else await call('run:stop', { runId: running.runId })
            return
          }
          if (running !== undefined) {
            useRuns.getState().show(running.runId)
            ui.showToast(`« ${favorite} » tourne déjà (Maj+F5 pour l’arrêter).`)
            return
          }
          await call('run:start', { genesisId, script: favorite })
        } catch (error) {
          ui.showToast(error instanceof IpcFailure ? error.message : 'Le lancement a échoué.')
        }
      })()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
