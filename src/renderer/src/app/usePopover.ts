import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Petit panneau qui s'ouvre d'un bouton (menus de la coque, spec 033) : Échap ou un clic hors de `ref` le referme, et
 * Échap rend le focus au bouton.
 */
export function usePopover<T extends HTMLElement>(): {
  readonly ref: RefObject<T | null>
  readonly open: boolean
  readonly toggle: () => void
  readonly close: () => void
} {
  const ref = useRef<T>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((value) => !value), [])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Node && ref.current?.contains(event.target) !== true) setOpen(false)
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setOpen(false)
      ref.current?.querySelector<HTMLElement>('[aria-expanded]')?.focus()
    }
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('keydown', escape)
    }
  }, [open])
  return { ref, open, toggle, close }
}
