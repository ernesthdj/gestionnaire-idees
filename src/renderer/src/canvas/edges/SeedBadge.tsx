import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { SeedView } from '@shared/ipc/neurons'
import { useUiStore } from '../../app/uiStore'
import { Button } from '../../components/atoms/Button'
import { call, IpcFailure } from '../../lib/ipc'

/** Données rafraîchies quand une graine est acceptée ou refusée. */
const AFFECTED = [['canvas'], ['seeds'], ['history']]

/**
 * Graine d'un lien accepté (FR-028) : pastille 🌱 au milieu du trait. Un clic (ou `Entrée`) ouvre la carte : titre,
 * pourquoi, « Refuser » / « Faire naître ». Un clic ailleurs ou `Échap` la referme.
 */
export function SeedBadge({ seed, dimmed }: { readonly seed: SeedView; readonly dimmed: boolean }): React.JSX.Element {
  const client = useQueryClient()
  const bear = useUiStore((state) => state.bear)
  const showToast = useUiStore((state) => state.showToast)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const cardId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLButtonElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  // Clic en dehors de la pastille et de sa carte : fermeture (phase de capture, avant React Flow).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target) !== true) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  // Carte ouverte au clavier : le focus va sur l'action principale.
  const [focusCard, setFocusCard] = useState(false)
  useEffect(() => {
    if (open && focusCard) primaryRef.current?.focus()
  }, [open, focusCard])
  const parents = `${seed.parents[0].title} × ${seed.parents[1].title}`

  const decide = async (accept: boolean): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      if (accept) {
        const result = await call<{ readonly rootId: string; readonly batchId: string }>('seeds:accept', {
          seedId: seed.id
        })
        bear(result.rootId, `« ${seed.title} » est née de ${parents}.`, result.batchId)
      } else {
        await call('seeds:reject', { seedId: seed.id })
        showToast('Graine refusée : elle ne sera plus proposée sur ce lien.')
      }
      await Promise.all(AFFECTED.map((queryKey) => client.invalidateQueries({ queryKey })))
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'La graine n’a pas pu être traitée.')
    } finally {
      setBusy(false)
    }
  }

  const onBadgeKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      setFocusCard(true)
      setOpen(true)
    }
  }

  // Échap referme la carte et rend le focus à la pastille, sans remonter à la carte ni à la plongée.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    badgeRef.current?.focus()
  }

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col items-center"
      style={{ opacity: dimmed ? 0.3 : 1 }}
      onKeyDown={onKeyDown}
    >
      <button
        ref={badgeRef}
        type="button"
        disabled={busy}
        onClick={() => {
          setFocusCard(false)
          setOpen((current) => !current)
        }}
        onKeyDown={onBadgeKeyDown}
        aria-label={`Graine de l’IA sur le lien ${parents} : ${seed.title}`}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-content-muted/30 bg-surface text-sm"
      >
        <span aria-hidden="true">🌱</span>
      </button>
      {open ? (
        <div
          id={cardId}
          role="dialog"
          aria-label={`Graine : ${seed.title}`}
          className="absolute top-full z-10 mt-2 w-64 rounded-lg border border-content-muted/30 bg-surface p-4 text-left shadow-lg"
        >
          <p className="text-sm font-semibold text-content">{seed.title}</p>
          <p className="mt-1 text-xs text-content-muted">{seed.why}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button disabled={busy} onClick={() => void decide(false)}>
              Refuser
            </Button>
            <Button ref={primaryRef} variant="primary" disabled={busy} onClick={() => void decide(true)}>
              Faire naître
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
