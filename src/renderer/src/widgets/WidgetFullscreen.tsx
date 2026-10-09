import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SettingsForm } from './SettingsForm'
import { useWidgetSettings } from './useWidgetSettings'

/**
 * Plein écran d'un widget (spec 026 D8) : le même cadre isolé, à taille réelle (pas de réduction d'échelle au-delà de
 * 760 px), avec ses réglages ancrés à droite et la demande à Claude en bas. Échap ou « Fermer » revient à la carte.
 */
export function WidgetFullscreen({
  blockId,
  title,
  frame,
  footer,
  onClose
}: {
  readonly blockId: string
  readonly title: string
  /** Le cadre isolé du widget : déplacé ici, il garde son pont avec l'application. */
  readonly frame: ReactNode
  readonly footer: ReactNode
  readonly onClose: () => void
}): React.JSX.Element {
  const settings = useWidgetSettings(blockId)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    close.current?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // Capturé avant la carte : Échap ferme le plein écran, rien d'autre.
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      previous?.focus()
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Plein écran : ${title}`}
      className="fixed inset-0 z-50 flex flex-col bg-surface text-content"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-content-muted/20 bg-surface-raised px-3 text-sm">
        <span aria-hidden="true">▣</span>
        <h2 className="flex-1 truncate font-semibold">{title}</h2>
        <button
          ref={close}
          type="button"
          onClick={onClose}
          className="h-8 rounded-md border border-content-muted/30 px-3 text-xs hover:border-accent"
        >
          Fermer (Échap)
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{frame}</div>
        {settings.fields.length === 0 || settings.values === null || settings.values === undefined ? null : (
          <aside
            aria-label="Réglages"
            className="w-80 shrink-0 overflow-y-auto border-l border-content-muted/20 bg-surface-raised/40"
          >
            <h3 className="px-3 pt-3 text-xs font-semibold">⚙ Réglages</h3>
            <SettingsForm
              fields={settings.fields}
              values={settings.values}
              onChange={settings.change}
              onReset={settings.reset}
            />
          </aside>
        )}
      </div>
      <div className="shrink-0">{footer}</div>
    </div>,
    document.body
  )
}
