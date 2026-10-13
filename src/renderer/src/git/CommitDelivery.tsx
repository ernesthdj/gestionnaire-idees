import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { call } from '../lib/ipc'

/** Élément de la carte de structure couvert par un commit (spec 030 D5). */
export interface CoveredElement {
  readonly id: string
  readonly key: string
  readonly title: string
}

/**
 * Après un commit (spec 030 D5) : les éléments de la carte dont les fichiers viennent d'être commités, une case par
 * élément cochée d'office ; « Passer en livrée » écrit un seul lot « par toi », annulable. Rien n'est écrit sans ce clic.
 */
export function CommitDelivery({
  elements,
  onDone
}: {
  readonly elements: readonly CoveredElement[]
  readonly onDone: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(elements.map((element) => element.id)))
  const [pending, setPending] = useState(false)
  const deliver = (): void => {
    setPending(true)
    void call('element:setStatus', { elementIds: [...checked], status: 'livree' })
      // La notification annulable vient du main (`map:changed`), comme pour toute écriture de la carte.
      .then(() => {
        onDone()
        return client.invalidateQueries({ queryKey: ['canvas'] })
      })
      .catch(() => showToast('Les statuts n’ont pas pu être changés.'))
      .finally(() => setPending(false))
  }
  return (
    <section
      aria-label="Éléments couverts par ce commit"
      className="flex flex-col gap-2 rounded-md border border-accent/40 bg-accent/5 p-2 text-sm"
    >
      <p className="font-semibold">Ce commit couvre ces éléments de la carte : les passer en livrée ?</p>
      <ul className="flex flex-col gap-1">
        {elements.map((element) => (
          <li key={element.id}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={checked.has(element.id)}
                onChange={() =>
                  setChecked((current) => {
                    const next = new Set(current)
                    if (next.has(element.id)) next.delete(element.id)
                    else next.add(element.id)
                    return next
                  })
                }
              />
              <span className="min-w-0 flex-1 truncate">{element.title}</span>
              <span className="shrink-0 font-mono text-xs text-content-muted">{element.key}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={pending || checked.size === 0} onClick={deliver}>
          Passer en livrée ({checked.size})
        </Button>
        <button type="button" className="card-button card-button-ghost" disabled={pending} onClick={onDone}>
          Plus tard
        </button>
      </div>
    </section>
  )
}
