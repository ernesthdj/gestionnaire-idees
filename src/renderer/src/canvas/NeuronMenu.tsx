import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { CanvasNeuronView } from '@shared/ipc/canvas'
import type { CategoryView } from '@shared/ipc/neurons'
import { Button } from '../components/atoms/Button'
import { call } from '../lib/ipc'

interface NeuronMenuProps {
  readonly neuron: CanvasNeuronView
  readonly categories: readonly CategoryView[]
  /** Position à l'écran (clic droit) ; le menu reste dans la fenêtre. */
  readonly at: { readonly x: number; readonly y: number }
  readonly onDive: () => void
  readonly onClose: () => void
}

/**
 * Menu d'une idée (clic droit, ou touche Menu / Maj+F10) : plonger, et corriger en un geste la nature ou la
 * catégorie proposées par l'IA (FR-008). Le choix de l'utilisateur ne sera plus jamais écrasé par l'IA.
 */
export function NeuronMenu({ neuron, categories, at, onDive, onClose }: NeuronMenuProps): React.JSX.Element {
  const client = useQueryClient()
  const [error, setError] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const ids = { title: useId(), nature: useId(), category: useId() }

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button, select')?.focus()
  }, [])

  const update = async (patch: { nature?: string; categorySlug?: string }): Promise<void> => {
    try {
      await call('neuron:update', { id: neuron.id, ...patch })
      setError('')
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch {
      setError('La modification n’a pas pu être enregistrée.')
    }
  }

  return (
    <div
      ref={panel}
      role="dialog"
      aria-labelledby={ids.title}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      className="fixed z-50 w-64 space-y-3 rounded-lg border border-content-muted/30 bg-surface p-4 text-sm text-content shadow-lg"
      style={{ left: Math.min(at.x, window.innerWidth - 272), top: Math.min(at.y, window.innerHeight - 248) }}
    >
      <p id={ids.title} className="truncate font-semibold">
        {neuron.title}
      </p>
      <Button variant="primary" className="w-full" onClick={onDive}>
        Plonger dans l’idée
      </Button>
      <div className="grid grid-cols-[88px_1fr] items-center gap-2">
        <label htmlFor={ids.nature}>Nature{neuron.natureSource === 'ai' ? ' ✦' : ''}</label>
        <select
          id={ids.nature}
          value={neuron.nature}
          onChange={(event) => void update({ nature: event.target.value })}
          className="h-8 rounded-md bg-surface-raised px-2"
        >
          <option value="action">Action</option>
          <option value="reflection">Réflexion</option>
        </select>
        <label htmlFor={ids.category}>Catégorie{neuron.categorySource === 'ai' ? ' ✦' : ''}</label>
        <select
          id={ids.category}
          value={neuron.category?.slug ?? ''}
          onChange={(event) => void update({ categorySlug: event.target.value })}
          className="h-8 rounded-md bg-surface-raised px-2"
        >
          {neuron.category === null ? <option value="">À classer</option> : null}
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
      {neuron.natureSource === 'ai' || neuron.categorySource === 'ai' ? (
        <p className="text-xs text-content-muted">✦ proposé par l’IA — ton choix remplace le sien.</p>
      ) : null}
      {error === '' ? null : (
        <p role="alert" className="text-xs">
          {error}
        </p>
      )}
      <Button className="w-full" onClick={onClose}>
        Fermer
      </Button>
    </div>
  )
}
