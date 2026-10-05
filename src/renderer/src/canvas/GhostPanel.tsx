import { useEffect } from 'react'
import type { IdeasCanvasView } from '@shared/ipc/canvas'
import { rankLabel } from '@shared/plan/rankLabel'
import { usePlanDecide } from './usePlanDecide'

/** Rangs du chemin d'un nœud du plan (de l'étape de niveau 1 à lui-même) ; vide pour un genesis. */
function ranksOf(view: IdeasCanvasView, nodeId: string): number[] {
  const ranks: number[] = []
  let current = view.steps.find((step) => step.id === nodeId)
  for (let guard = 0; current !== undefined && guard < 10; guard++) {
    ranks.unshift(current.rank)
    const parentId = current.parentId
    current = view.steps.find((step) => step.id === parentId)
  }
  return ranks
}

/**
 * Détail d'une étape proposée par Claude (spec 011 US1) : ce qu'elle est, pourquoi, où elle naîtra et ce qu'elle
 * attend — à lire avant de la valider ou de la refuser.
 */
export function GhostPanel({
  view,
  ghostId,
  onClose
}: {
  readonly view: IdeasCanvasView
  readonly ghostId: string
  readonly onClose: () => void
}): React.JSX.Element {
  const { decide, busy } = usePlanDecide()
  const proposal = view.proposals.find((entry) => entry.items.some((item) => item.id === ghostId))
  const ghost = proposal?.items.find((item) => item.id === ghostId)
  // Décidé (ou remplacé) entre-temps : le volet se referme.
  useEffect(() => {
    if (ghost === undefined) onClose()
  }, [ghost, onClose])
  if (proposal === undefined || ghost === undefined) return <></>

  const parentTitle =
    view.ideas.find((idea) => idea.id === proposal.parentId)?.title ??
    view.steps.find((step) => step.id === proposal.parentId)?.title ??
    'nœud'
  const parentRanks = ranksOf(view, proposal.parentId)
  const existing = view.steps.filter((step) => step.parentId === proposal.parentId).length
  const label = rankLabel([...parentRanks, existing + ghost.rank])
  const awaited = ghost.waitsFor.map((id) => {
    const other = proposal.items.find((item) => item.id === id)
    if (other !== undefined) return `${rankLabel([...parentRanks, existing + other.rank])} ${other.title} (proposée)`
    const step = view.steps.find((entry) => entry.id === id)
    return step === undefined ? 'une étape retirée' : `${rankLabel([...parentRanks, step.rank])} ${step.title}`
  })

  return (
    <section aria-labelledby="ghost-title" className="flex flex-col gap-4 p-4 text-sm">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-content-muted">Étape proposée par Claude · pas encore créée</p>
          <h2 id="ghost-title" className="text-base font-semibold">
            <span className="mr-2">{label}</span>
            {ghost.title}
          </h2>
          <p className="text-xs text-content-muted">Dans le plan de « {parentTitle} »</p>
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
        <h3 className="text-xs font-semibold text-content-muted uppercase">Pourquoi</h3>
        <p className="mt-1 leading-relaxed whitespace-pre-wrap">{ghost.why}</p>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-content-muted uppercase">Attend</h3>
        {awaited.length === 0 ? (
          <p className="mt-1 text-content-muted">Rien : elle peut démarrer dès sa création.</p>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            {awaited.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-content-muted">
        La valider verrouille « {parentTitle} » (sa fiche ne bougera plus) et crée l’étape avec sa propre conversation.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide({ proposalId: proposal.id, accept: [ghost.id], reject: [] })}
          className="h-9 rounded-md bg-accent px-3 font-semibold text-surface disabled:opacity-50"
        >
          Valider cette étape
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide({ proposalId: proposal.id, accept: [], reject: [ghost.id] })}
          className="h-9 rounded-md border border-content-muted/40 px-3 disabled:opacity-50"
        >
          Refuser
        </button>
      </div>
    </section>
  )
}
