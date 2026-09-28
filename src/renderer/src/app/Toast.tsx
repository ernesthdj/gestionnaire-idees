import { useEffect, useState } from 'react'
import { useUiStore } from './uiStore'
import { useUndo } from './useUndo'

/** Durée d'affichage d'une notification (FR-019 : 10 secondes pour annuler). */
export const TOAST_MS = 10_000

/** Notification brève en bas à droite, annoncée aux lecteurs d'écran, avec « Annuler » si elle en propose. */
export function Toast(): React.JSX.Element | null {
  const toast = useUiStore((state) => state.toast)
  const hideToast = useUiStore((state) => state.hideToast)
  const showToast = useUiStore((state) => state.showToast)
  const undo = useUndo()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(hideToast, TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, hideToast])

  if (toast === null) return null
  const undoBatchId = toast.undoBatchId
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex max-w-md items-center gap-3 rounded-lg bg-surface-raised px-4 py-3 text-sm text-content shadow-lg"
    >
      <span>{toast.text}</span>
      {undoBatchId === undefined ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void undo(undoBatchId).then((outcome) => {
              setBusy(false)
              showToast(outcome.ok ? 'Éclosion annulée : l’idée est revenue en développement.' : outcome.message)
            })
          }}
          className="h-8 rounded-md px-3 font-semibold text-accent hover:bg-surface"
        >
          Annuler
        </button>
      )}
      <button type="button" aria-label="Fermer la notification" onClick={hideToast} className="px-1">
        ×
      </button>
    </div>
  )
}
