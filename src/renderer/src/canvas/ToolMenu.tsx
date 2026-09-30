import { useEffect, useRef } from 'react'

export type Tool = 'idea' | 'label' | 'widget'

const TOOLS: readonly { readonly tool: Tool; readonly icon: string; readonly label: string; readonly hint: string }[] =
  [
    { tool: 'idea', icon: '◆', label: 'Nouvelle idée', hint: 'Une idée à développer' },
    { tool: 'label', icon: 'T', label: 'Note', hint: 'Un texte libre posé sur la carte' },
    { tool: 'widget', icon: '▣', label: 'Widget IA', hint: 'Un outil que Claude fabrique pour toi' }
  ]

interface ToolMenuProps {
  /** Position à l'écran du clic droit ; le menu reste dans la fenêtre. */
  readonly at: { readonly x: number; readonly y: number }
  readonly onPick: (tool: Tool) => void
  readonly onClose: () => void
}

/**
 * Boîte à outils de la carte (spec 004 FR-001) : clic droit dans le vide, l'outil choisi crée son objet à cet
 * endroit. Menu au sens ARIA : flèches haut/bas, Début/Fin, Entrée ; Échap ou clic ailleurs le referme.
 */
export function ToolMenu({ at, onPick, onClose }: ToolMenuProps): React.JSX.Element {
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Node && menu.current?.contains(event.target) !== true) onClose()
    }
    window.addEventListener('pointerdown', outside, true)
    return () => window.removeEventListener('pointerdown', outside, true)
  }, [onClose])

  const move = (event: React.KeyboardEvent): void => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === 'ArrowDown'
        ? (index + 1) % items.length
        : event.key === 'ArrowUp'
          ? (index - 1 + items.length) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : null
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (next !== null) {
      event.preventDefault()
      items[next]?.focus()
    }
  }

  return (
    <div
      ref={menu}
      role="menu"
      aria-label="Outils de la carte"
      onKeyDown={move}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-50 w-60 rounded-lg border border-content-muted/30 bg-surface p-1 text-sm text-content shadow-lg"
      style={{ left: Math.min(at.x, window.innerWidth - 248), top: Math.min(at.y, window.innerHeight - 180) }}
    >
      {TOOLS.map(({ tool, icon, label, hint }) => (
        <button
          key={tool}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => onPick(tool)}
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-raised focus-visible:bg-surface-raised"
        >
          <span aria-hidden="true" className="w-4 text-center font-semibold text-content-muted">
            {icon}
          </span>
          <span>
            <span className="block font-medium">{label}</span>
            <span className="block text-xs text-content-muted">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
