import { useEffect } from 'react'
import { useUiStore } from './uiStore'

/** Durée d'affichage d'une notification (FR-019 : 10 secondes). */
export const TOAST_MS = 10_000

/** Notification brève en bas à droite, annoncée aux lecteurs d'écran, fermée seule après 10 s. */
export function Toast(): React.JSX.Element | null {
  const toast = useUiStore((state) => state.toast)
  const hideToast = useUiStore((state) => state.hideToast)
  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(hideToast, TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, hideToast])
  if (toast === null) return null
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg bg-surface-raised px-4 py-3 text-sm text-content shadow-lg"
    >
      <span>{toast.text}</span>
      <button type="button" aria-label="Fermer la notification" onClick={hideToast} className="px-1">
        ×
      </button>
    </div>
  )
}
