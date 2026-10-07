import { useId, useState } from 'react'
import { Button } from '../components/atoms/Button'

/** Titres listés au plus dans la confirmation ; au-delà, « et N autres ». */
const LISTED = 5

export interface RemoveIdeasDialogProps {
  readonly ideas: readonly { readonly id: string; readonly title: string }[]
  /** Supprime les idées ; `true` si c'est fait. */
  readonly onConfirm: () => Promise<boolean>
  readonly onClose: () => void
}

/**
 * Confirmation unique pour supprimer les idées sélectionnées (touche Suppr, proposition de l'Analyste du 2026-10-07) :
 * une seule question, un seul « Annuler » ensuite. « Garder » a le focus : Entrée par réflexe ne supprime rien.
 */
export function RemoveIdeasDialog({ ideas, onConfirm, onClose }: RemoveIdeasDialogProps): React.JSX.Element {
  const ids = { title: useId(), description: useId() }
  const [busy, setBusy] = useState(false)
  const count = ideas.length
  const confirm = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    const done = await onConfirm()
    setBusy(false)
    if (done) onClose()
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.description}
        className="w-full max-w-md space-y-3 rounded-xl bg-surface p-4 text-content shadow-xl"
      >
        <h2 id={ids.title} className="text-base font-semibold">
          {count > 1 ? `Supprimer ${count} idées ?` : `Supprimer « ${ideas[0]?.title ?? ''} » ?`}
        </h2>
        <div id={ids.description} className="space-y-2 text-sm">
          {count > 1 ? (
            <ul className="list-disc pl-5">
              {ideas.slice(0, LISTED).map((idea) => (
                <li key={idea.id}>{idea.title}</li>
              ))}
              {count > LISTED ? <li>et {count - LISTED} autres</li> : null}
            </ul>
          ) : null}
          <p>
            {count > 1 ? 'Elles partent' : 'Elle part'} avec tout leur contenu. Un seul « Annuler » (notification ou
            Historique) {count > 1 ? 'les restaure toutes' : 'la restaure'}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" autoFocus onClick={onClose}>
            Garder
          </Button>
          <Button variant="danger" className="flex-1" disabled={busy} onClick={() => void confirm()}>
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  )
}
