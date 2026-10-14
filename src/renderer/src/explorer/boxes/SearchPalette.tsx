import { useEffect, useId, useMemo, useState } from 'react'
import type { ExplorerMapView, ExplorerPlaceView } from '@shared/ipc/reprise'
import { call } from '../../lib/ipc'
import { searchMap, type SearchHit } from './sheet'

/** Un élément trouvé par l'analyse hors de la carte (une classe, une fonction au-delà des 20 d'un fichier…). */
export type SymbolHit = ExplorerPlaceView & { readonly key: string; readonly title: string; readonly where: string }

export type PaletteHit =
  { readonly kind: 'map'; readonly hit: SearchHit } | { readonly kind: 'symbol'; readonly place: SymbolHit }

const SYMBOLS_SHOWN = 10

/**
 * Recherche Ctrl+K de l'explorateur (spec 031 D9) : un fichier ou une fonction, où qu'il soit. Les fichiers et les
 * fonctions de la carte répondent tout de suite ; les autres éléments de l'analyse suivent. Flèches pour choisir, Entrée
 * pour y aller, Échap pour fermer.
 */
export function SearchPalette({
  genesisId,
  map,
  onPick,
  onClose
}: {
  readonly genesisId: string
  readonly map: ExplorerMapView
  readonly onPick: (hit: PaletteHit) => void
  readonly onClose: () => void
}): React.JSX.Element {
  const ids = { title: useId(), list: useId() }
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [symbols, setSymbols] = useState<readonly SymbolHit[]>([])
  const local = useMemo(() => searchMap(map, query), [map, query])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSymbols([])
      return
    }
    let live = true
    const timer = setTimeout(() => {
      call<{ readonly results: readonly SymbolHit[] }>('explorer:search', { genesisId, query: trimmed })
        .then((found) => live && setSymbols(found.results))
        .catch(() => live && setSymbols([]))
    }, 200)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, genesisId])

  const hits = useMemo((): PaletteHit[] => {
    const seen = new Set(local.map((hit) => `${hit.file.path}#${hit.fn ?? hit.file.title}`))
    const others = symbols
      .filter((place) => place.path !== null && !seen.has(`${place.path}#${place.title}`))
      .slice(0, SYMBOLS_SHOWN)
    return [
      ...local.map((hit) => ({ kind: 'map', hit }) as const),
      ...others.map((place) => ({ kind: 'symbol', place }) as const)
    ]
  }, [local, symbols])
  useEffect(() => setActive(0), [query])
  const current = Math.min(active, Math.max(0, hits.length - 1))
  const optionId = (index: number): string => `${ids.list}-${index}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        className="flex max-h-[70vh] w-full max-w-xl flex-col gap-2 rounded-xl bg-surface p-3 text-content shadow-xl"
      >
        <h2 id={ids.title} className="sr-only">
          Rechercher un fichier ou une fonction
        </h2>
        <input
          type="text"
          role="combobox"
          aria-label="Fichier ou fonction"
          aria-expanded={hits.length > 0}
          aria-controls={ids.list}
          aria-autocomplete="list"
          aria-activedescendant={hits.length === 0 ? undefined : optionId(current)}
          autoFocus
          value={query}
          maxLength={100}
          placeholder="Un fichier ou une fonction…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (hits.length === 0) return
              const step = event.key === 'ArrowDown' ? 1 : -1
              setActive((current + step + hits.length) % hits.length)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              const hit = hits[current]
              if (hit !== undefined) onPick(hit)
            }
          }}
          className="h-9 rounded-md bg-surface-raised px-3 text-sm"
        />
        <ul id={ids.list} role="listbox" aria-label="Résultats" className="min-h-0 flex-1 overflow-y-auto">
          {hits.map((hit, index) => {
            const { name, where } =
              hit.kind === 'map'
                ? {
                    name: hit.hit.fn ?? hit.hit.file.title,
                    where: hit.hit.fn === null ? hit.hit.file.path : `${hit.hit.file.title} · ${hit.hit.file.path}`
                  }
                : { name: hit.place.title, where: hit.place.where }
            return (
              <li
                key={hit.kind === 'map' ? `${hit.hit.file.key}#${hit.hit.fn ?? ''}` : hit.place.key}
                id={optionId(index)}
                role="option"
                aria-selected={index === current}
                onMouseMove={() => setActive(index)}
                onClick={() => onPick(hit)}
                className={`cursor-pointer rounded px-2 py-1 text-sm ${index === current ? 'bg-surface-raised' : ''}`}
              >
                <span aria-hidden="true" className="mr-2 text-content-muted">
                  {hit.kind === 'map' && hit.hit.fn === null ? '▤' : 'ƒ'}
                </span>
                <span className="font-semibold">{name}</span>{' '}
                <span className="text-xs text-content-muted">{where}</span>
              </li>
            )
          })}
        </ul>
        <p role="status" className="text-xs text-content-muted">
          {query.trim() === ''
            ? 'Tape le nom d’un fichier ou d’une fonction · Entrée : y aller · Échap : fermer'
            : hits.length === 0
              ? 'Rien trouvé.'
              : `${hits.length} résultat${hits.length > 1 ? 's' : ''} · ↑ ↓ pour choisir · Entrée : y aller`}
        </p>
      </div>
    </div>
  )
}
