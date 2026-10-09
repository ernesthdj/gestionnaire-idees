import { useEffect, useRef } from 'react'
import type { RunView } from '@shared/run/run'
import { localUrls } from '@shared/run/urls'
import { call } from '../lib/ipc'
import { useRuns } from './runStore'

const STATE_TEXT: Readonly<Record<RunView['state'], string>> = {
  running: 'en cours',
  exited: 'terminé',
  failed: 'en échec',
  stopped: 'arrêté'
}

/**
 * Panneau de sortie des projets lancés (spec 025 D1) : un onglet par lancement (projet · script · état), la sortie en
 * direct (bornée, couleurs retirées), « Arrêter », « Relancer », « Fermer l'onglet ». Pas de saisie interactive.
 */
export function RunPanel(): React.JSX.Element | null {
  const runs = useRuns((state) => state.runs)
  const activeId = useRuns((state) => state.activeId)
  const open = useRuns((state) => state.open)
  const { show, toggle, remove } = useRuns.getState()
  const output = useRef<HTMLPreElement>(null)
  const active = runs.find((run) => run.runId === activeId) ?? runs.at(-1)
  // Adresse locale annoncée par un serveur de dev (« Local: http://localhost:5173/ ») : la première.
  const url = active === undefined || active.state !== 'running' ? undefined : localUrls(active.output)[0]
  useEffect(() => {
    const element = output.current
    if (element !== null) element.scrollTop = element.scrollHeight
  }, [active?.output])
  if (runs.length === 0) return null

  return (
    <section aria-label="Projets lancés" className="flex shrink-0 flex-col border-t border-content-muted/20 bg-surface">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggle()}
          className="rounded px-2 py-1 text-xs font-semibold hover:bg-surface-raised"
        >
          {open ? '▾' : '▸'} Sortie
        </button>
        <div role="tablist" aria-label="Lancements" className="flex gap-1">
          {runs.map((run) => (
            <button
              key={run.runId}
              type="button"
              role="tab"
              aria-selected={run.runId === active?.runId}
              onClick={() => show(run.runId)}
              className={`whitespace-nowrap rounded px-2 py-1 text-xs ${
                run.runId === active?.runId ? 'bg-accent/15 font-semibold' : 'hover:bg-surface-raised'
              }`}
            >
              {run.state === 'running' ? '●' : '○'} {run.project} · {run.script} · {STATE_TEXT[run.state]}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {url === undefined || active === undefined ? null : (
          <button
            type="button"
            onClick={() => void call('run:openUrl', { runId: active.runId, url }).catch(() => undefined)}
            title="Ouvrir l’adresse annoncée par le projet dans ton navigateur"
            className="whitespace-nowrap rounded border border-accent/60 px-2 py-1 text-xs text-accent hover:bg-surface-raised"
          >
            🌐 Ouvrir {url}
          </button>
        )}
        {active === undefined ? null : active.state === 'running' ? (
          <button
            type="button"
            onClick={() => void call('run:stop', { runId: active.runId })}
            className="rounded border border-con/60 px-2 py-1 text-xs text-con"
          >
            Arrêter
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                void call('run:dismiss', { runId: active.runId }).then(() =>
                  call('run:start', { genesisId: active.genesisId, script: active.script })
                )
              }
              className="rounded border border-content-muted/40 px-2 py-1 text-xs"
            >
              Relancer
            </button>
            <button
              type="button"
              onClick={() => void call('run:dismiss', { runId: active.runId }).then(() => remove(active.runId))}
              className="rounded border border-content-muted/40 px-2 py-1 text-xs"
            >
              Fermer l’onglet
            </button>
          </>
        )}
      </div>
      {!open || active === undefined ? null : (
        <pre
          ref={output}
          role="log"
          aria-label={`Sortie de ${active.project} · ${active.script}`}
          className="h-48 overflow-auto whitespace-pre-wrap bg-surface-raised px-3 py-2 font-mono text-xs"
        >
          {active.output === '' ? 'En attente de la sortie…' : active.output}
          {active.state === 'running'
            ? ''
            : `\n— ${STATE_TEXT[active.state]}${active.exitCode === null || active.state === 'stopped' ? '' : ` (code ${active.exitCode})`}`}
        </pre>
      )}
    </section>
  )
}
