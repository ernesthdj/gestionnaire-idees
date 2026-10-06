import { useEffect } from 'react'
import type { IdeasCanvasView } from '@shared/ipc/canvas'
import { CommandsSection } from './CommandsSection'
import { finalStateLabel } from './nodes/PlanNode'
import { useFinalDecide } from './useFinalDecide'

/**
 * Détail d'une action finale (spec 013 US1) : livrable annoncé et raison, à lire avant d'accepter la proposition de
 * Claude ; une action acceptée peut redevenir une étape ordinaire.
 */
export function FinalPanel({
  view,
  neuronId,
  onClose
}: {
  readonly view: IdeasCanvasView
  readonly neuronId: string
  readonly onClose: () => void
}): React.JSX.Element {
  const { decide, demote, execute, stop, busy } = useFinalDecide()
  const step = view.steps.find((entry) => entry.id === neuronId)
  const final = step?.final
  // Refusée ou rétrogradée entre-temps : le volet se referme.
  useEffect(() => {
    if (final === undefined) onClose()
  }, [final, onClose])
  if (step === undefined || final === undefined) return <></>
  const proposed = final.state === 'proposee'
  const pending = step.waitsFor
    .map((id) => view.steps.find((entry) => entry.id === id))
    .filter((entry) => entry !== undefined && entry.status !== 'fait')
    .map((entry) => entry?.title ?? '')
  const done = step.status === 'fait'

  return (
    <section aria-labelledby="final-title" className="flex flex-col gap-4 p-4 text-sm">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-content-muted">
            {proposed ? 'Action finale proposée par Claude · en attente de ta décision' : 'Action finale'}
          </p>
          <h2 id="final-title" className="text-base font-semibold">
            {step.title}
          </h2>
          {proposed ? null : (
            <p className="text-xs font-semibold text-action">{finalStateLabel(final.state, step.status)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le détail"
          className="h-8 w-8 shrink-0 rounded-md hover:bg-surface-raised"
        >
          ×
        </button>
      </header>
      <div>
        <h3 className="text-xs font-semibold text-content-muted uppercase">Livrable annoncé</h3>
        <p className="mt-1 leading-relaxed whitespace-pre-wrap">{final.deliverable}</p>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-content-muted uppercase">Pourquoi elle est prête</h3>
        <p className="mt-1 leading-relaxed whitespace-pre-wrap">{final.reason}</p>
      </div>
      {proposed ? (
        <>
          <p className="text-xs text-content-muted">
            L’accepter fait de cette étape une feuille exécutable : elle ne se découpera plus en sous-étapes. Claude
            n’écrira dans le projet que lorsque tu lanceras l’exécution.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide(step.id, true)}
              className="h-9 rounded-md bg-action px-3 font-semibold text-surface disabled:opacity-50"
            >
              Accepter l’action finale
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide(step.id, false)}
              className="h-9 rounded-md border border-content-muted/40 px-3 disabled:opacity-50"
            >
              Refuser
            </button>
          </div>
        </>
      ) : final.state === 'en_cours' ? (
        <div className="flex flex-col gap-2">
          <p role="status">Claude exécute cette action : son travail défile dans la conversation de l’étape.</p>
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void stop(step.id)}
              className="h-9 rounded-md border border-content-muted/40 px-3 disabled:opacity-50"
            >
              Arrêter l’exécution
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {done ? null : (
            <>
              <p className="text-xs text-content-muted">
                {final.projectLinked
                  ? 'Claude écrira uniquement dans le dossier du projet lié et ne lancera que les scripts que tu autorises ci-dessous. Chaque fichier écrit s’annule dans l’Historique.'
                  : 'Aucun dossier de projet lié au genesis : Claude ne produira que des documents.'}
              </p>
              {pending.length === 0 ? null : (
                <div role="alert" className="rounded-md bg-surface-raised p-2 text-xs">
                  Prérequis pas encore faits : {pending.map((title) => `« ${title} »`).join(', ')}.
                </div>
              )}
              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void execute(step.id, pending.length > 0)}
                  className="h-9 rounded-md bg-action px-3 font-semibold text-surface disabled:opacity-50"
                >
                  {pending.length > 0 ? 'Exécuter quand même' : 'Exécuter'}
                </button>
              </div>
            </>
          )}
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void demote(step.id)}
              className="h-9 rounded-md border border-content-muted/40 px-3 disabled:opacity-50"
            >
              Redevenir une étape ordinaire
            </button>
          </div>
        </div>
      )}
      {proposed ? null : <CommandsSection genesisId={step.genesisId} />}
    </section>
  )
}
