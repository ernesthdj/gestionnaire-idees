import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { RunScriptsView } from '@shared/run/run'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'
import { useRuns } from './runStore'

export const runKey = (genesisId: string) => ['run', genesisId] as const

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'Le lancement a échoué.')

/**
 * Lancer le projet depuis sa barre sur la carte (spec 025) : « ▶ <favori> », le choix du script, « ■ Arrêter » quand il
 * tourne ; un projet non de confiance propose « Faire confiance… » (confirmé, avec ce que ça permet).
 */
export function RunButton({ genesisId }: { readonly genesisId: string }): React.JSX.Element | null {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [trusting, setTrusting] = useState(false)
  const scripts = useQuery({
    queryKey: runKey(genesisId),
    queryFn: () => call<RunScriptsView>('run:scripts', { genesisId }),
    retry: false
  })
  const running = useRuns((state) =>
    state.runs.find(
      (run) => run.genesisId === genesisId && run.state === 'running' && run.script === scripts.data?.favorite
    )
  )
  const start = useMutation({
    mutationFn: (script: string) => call('run:start', { genesisId, script }),
    onError: (error) => showToast(errorText(error))
  })
  const stop = useMutation({ mutationFn: (runId: string) => call('run:stop', { runId }) })
  const favorite = useMutation({
    mutationFn: (script: string) => call<RunScriptsView>('run:setFavorite', { genesisId, script }),
    onSuccess: (view) => client.setQueryData(runKey(genesisId), view)
  })
  const trust = useMutation({
    mutationFn: () => call<RunScriptsView>('project:trust', { genesisId, trusted: true, confirm: true }),
    onSuccess: (view) => {
      setTrusting(false)
      client.setQueryData(runKey(genesisId), view)
      void client.invalidateQueries({ queryKey: ['git', genesisId] })
    }
  })

  const view = scripts.data
  if (view === undefined || !view.hasPackage || view.scripts.length === 0 || view.favorite === null) return null
  const stopClick = (event: React.MouseEvent): void => event.stopPropagation()

  if (!view.trusted) {
    return (
      <div className="relative flex items-center gap-1" onClick={stopClick}>
        <button
          type="button"
          onClick={() => setTrusting((value) => !value)}
          aria-expanded={trusting}
          title="Ce projet n’est pas de confiance : ses scripts ne se lancent pas depuis l’app"
          className="h-7 whitespace-nowrap rounded-md border border-content-muted/40 px-2 text-xs text-content hover:bg-surface"
        >
          🔒 Lancer…
        </button>
        {trusting ? (
          <div
            role="dialog"
            aria-label="Faire confiance à ce projet"
            className="absolute left-0 top-9 z-30 flex w-80 flex-col gap-2 rounded-md border border-content-muted/30 bg-surface p-3 text-xs shadow-lg"
          >
            <p>
              Faire confiance à ce projet permet de lancer ses scripts npm d’un clic (ex. « {view.favorite} ») et
              exécute ses hooks git. Ne le fais que pour un projet que tu connais, jamais pour un dépôt inconnu cloné
              tel quel.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={trust.isPending}
                onClick={() => trust.mutate()}
                className="rounded-md bg-accent px-2 py-1 text-surface disabled:opacity-50"
              >
                Faire confiance
              </button>
              <button type="button" onClick={() => setTrusting(false)} className="rounded-md border px-2 py-1">
                Annuler
              </button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1" onClick={stopClick}>
      {running === undefined ? (
        <button
          type="button"
          disabled={start.isPending}
          onClick={() => start.mutate(view.favorite ?? '')}
          aria-label={`Lancer le script ${view.favorite}`}
          title={`npm run ${view.favorite} (F5)`}
          className="h-7 whitespace-nowrap rounded-md bg-accent px-2 text-xs text-surface hover:opacity-90 disabled:opacity-50"
        >
          ▶
        </button>
      ) : (
        <button
          type="button"
          disabled={stop.isPending}
          onClick={() => stop.mutate(running.runId)}
          aria-label={`Arrêter le script ${view.favorite}`}
          title="Arrêter (Maj+F5)"
          className="h-7 whitespace-nowrap rounded-md border border-con/60 px-2 text-xs text-con hover:bg-surface"
        >
          ■
        </button>
      )}
      <label className="sr-only" htmlFor={`run-script-${genesisId}`}>
        Script favori
      </label>
      <select
        id={`run-script-${genesisId}`}
        value={view.favorite}
        onChange={(event) => favorite.mutate(event.target.value)}
        title="Script lancé par ▶ et F5"
        className="h-7 max-w-28 rounded-md border border-content-muted/40 bg-surface px-1 text-xs text-content"
      >
        {view.scripts.map((script) => (
          <option key={script.name} value={script.name} title={script.command}>
            {script.name}
          </option>
        ))}
      </select>
    </div>
  )
}
