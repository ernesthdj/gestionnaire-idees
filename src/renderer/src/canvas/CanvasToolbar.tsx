import { useEffect, useId, useState } from 'react'
import type { CanvasFilterInput, IdeasCanvasView } from '@shared/ipc/canvas'
import { Button } from '../components/atoms/Button'

interface CanvasToolbarProps {
  readonly view: IdeasCanvasView | undefined
  readonly filter: CanvasFilterInput
  readonly onFilter: (filter: CanvasFilterInput) => void
  readonly onRecenter: () => void
  readonly onAddBlock: () => void
  /** « Reprendre un projet existant » (spec 017) : le chemin inverse de « Nouvelle idée ». */
  readonly onImport: () => void
}

const SEARCH_DEBOUNCE_MS = 250

/** Filtre sans la clé donnée (une valeur vide retire le critère). */
function withOption(filter: CanvasFilterInput, key: keyof CanvasFilterInput, value: string): CanvasFilterInput {
  const next: Record<string, string> = {}
  for (const [name, current] of Object.entries(filter)) if (name !== key && current !== undefined) next[name] = current
  if (value !== '') next[key] = value
  return next as CanvasFilterInput
}

/** En-tête de l'écran Idées (FR-011) : compteurs, filtres, recherche, recentrer (une idée se crée au double-clic). */
export function CanvasToolbar({
  view,
  filter,
  onFilter,
  onRecenter,
  onAddBlock,
  onImport
}: CanvasToolbarProps): React.JSX.Element {
  const [search, setSearch] = useState(filter.search ?? '')
  const ids = { nature: useId(), category: useId(), search: useId() }

  // Recherche appliquée après une courte pause de frappe.
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === (filter.search ?? '')) return
    const timer = setTimeout(() => onFilter(withOption(filter, 'search', trimmed)), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, filter, onFilter])

  const setOption = (key: 'nature' | 'categoryId', value: string): void => onFilter(withOption(filter, key, value))

  const counts = view?.counts
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-content-muted/20 px-4 py-2 text-sm">
      <p className="mr-2 text-content-muted" aria-live="polite">
        {counts === undefined
          ? 'Chargement…'
          : `${counts.raw} brute${counts.raw > 1 ? 's' : ''} · ${counts.developing} en dév. · ${counts.hatched} éclose${counts.hatched > 1 ? 's' : ''}`}
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label htmlFor={ids.nature} className="sr-only">
          Filtrer par nature
        </label>
        <select
          id={ids.nature}
          value={filter.nature ?? ''}
          onChange={(event) => setOption('nature', event.target.value)}
          className="h-8 rounded-md bg-surface-raised px-2"
        >
          <option value="">Toutes natures</option>
          <option value="action">Action</option>
          <option value="reflection">Réflexion</option>
        </select>
        <label htmlFor={ids.category} className="sr-only">
          Filtrer par catégorie
        </label>
        <select
          id={ids.category}
          value={filter.categoryId ?? ''}
          onChange={(event) => setOption('categoryId', event.target.value)}
          className="h-8 rounded-md bg-surface-raised px-2"
        >
          <option value="">Toutes catégories</option>
          {view?.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        <label htmlFor={ids.search} className="sr-only">
          Rechercher une idée
        </label>
        <input
          id={ids.search}
          type="search"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher…"
          className="h-8 w-48 rounded-md bg-surface-raised px-2"
        />
        <Button onClick={onImport} title="Importer un projet écrit par d’autres pour le comprendre (dossier)">
          Reprendre un projet existant
        </Button>
        <Button onClick={onAddBlock} title="Bloc libre : accueillera les mini-widgets en v2">
          + Bloc
        </Button>
        <Button onClick={onRecenter}>Recentrer</Button>
      </div>
    </div>
  )
}
