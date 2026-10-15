import { memo, useEffect, useId, useState } from 'react'
import type { CanvasFilterInput, IdeasCanvasView } from '@shared/ipc/canvas'
import { Icon, type IconName } from '../app/Icon'
import { usePopover } from '../app/usePopover'

interface CanvasToolbarProps {
  readonly view: IdeasCanvasView | undefined
  readonly filter: CanvasFilterInput
  readonly onFilter: (filter: CanvasFilterInput) => void
  readonly onRecenter: () => void
  /** « Réorganiser » (spec 022 D22) : les nœuds glissent vers l'autre disposition. */
  readonly onReorder: () => void
  /** Cartes de détails ouvertes ; « Fermer les cartes » apparaît s'il y en a. */
  readonly openCards: number
  readonly onCloseCards: () => void
  /**
   * « Reprendre un projet existant » (spec 017) : le chemin inverse de « Nouvelle idée ». Absent sur le canevas d'un
   * projet (un projet par canevas, spec 024) : la reprise se lance alors depuis le Project Manager.
   */
  readonly onImport?: () => void
}

const SEARCH_DEBOUNCE_MS = 250

/** Filtre sans la clé donnée (une valeur vide retire le critère). */
function withOption(filter: CanvasFilterInput, key: keyof CanvasFilterInput, value: string): CanvasFilterInput {
  const next: Record<string, string> = {}
  for (const [name, current] of Object.entries(filter)) if (name !== key && current !== undefined) next[name] = current
  if (value !== '') next[key] = value
  return next as CanvasFilterInput
}

/** Un outil du dock : son icône, son libellé court dessous ; `name` : son nom complet quand le libellé ne suffit pas. */
function DockButton({
  icon,
  label,
  name,
  title,
  pressed,
  expanded,
  onClick
}: {
  readonly icon: IconName
  readonly label: string
  readonly name?: string
  readonly title?: string
  readonly pressed?: boolean
  readonly expanded?: boolean
  readonly onClick: () => void
}): React.JSX.Element {
  const on = pressed === true || expanded === true
  return (
    <button
      type="button"
      {...(name === undefined ? {} : { 'aria-label': name })}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      {...(expanded === undefined ? {} : { 'aria-expanded': expanded })}
      title={title ?? name ?? label}
      onClick={onClick}
      className={`flex h-11 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-[10px] transition-colors duration-150 ${
        on ? 'bg-accent/10 text-accent' : 'text-content hover:bg-surface-raised'
      }`}
    >
      <Icon name={icon} size={17} />
      <span>{label}</span>
    </button>
  )
}

/**
 * Dock d'outils de la carte (spec 033 D7, ex-en-tête FR-011) : flottant en bas, au centre ; compteurs, recherche (le
 * champ se déplie), filtres (en panneau), puis Fermer les cartes, Reprendre un projet, Réorganiser, Recentrer. Bloc
 * libre et liens d'analyse sont au clic droit (D8) ; une idée se crée au double-clic.
 */
export const CanvasToolbar = memo(function CanvasToolbar({
  view,
  filter,
  onFilter,
  onRecenter,
  onReorder,
  openCards,
  onCloseCards,
  onImport
}: CanvasToolbarProps): React.JSX.Element {
  const [search, setSearch] = useState(filter.search ?? '')
  const [searching, setSearching] = useState(search !== '')
  const filters = usePopover<HTMLDivElement>()
  const searchId = useId()

  // Recherche appliquée après une courte pause de frappe.
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === (filter.search ?? '')) return
    const timer = setTimeout(() => onFilter(withOption(filter, 'search', trimmed)), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, filter, onFilter])

  const setOption = (key: 'nature' | 'categoryId', value: string): void => onFilter(withOption(filter, key, value))
  const filtered = filter.nature !== undefined || filter.categoryId !== undefined

  const counts = view?.counts
  const countsText =
    counts === undefined
      ? 'Chargement…'
      : `${counts.raw} brute${counts.raw > 1 ? 's' : ''} · ${counts.developing} en dév. · ${counts.hatched} éclose${counts.hatched > 1 ? 's' : ''}`
  return (
    <div
      role="toolbar"
      aria-label="Outils de la carte"
      className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl bg-surface/90 p-1 text-sm shadow-lg backdrop-blur-sm"
    >
      <p
        className="flex flex-col items-center px-2 text-[10px] leading-tight text-content-muted"
        aria-live="polite"
        title={countsText}
      >
        <span className="sr-only">{countsText}</span>
        <strong aria-hidden="true" className="text-[13px] text-content">
          {counts === undefined ? '…' : `${counts.raw} · ${counts.developing} · ${counts.hatched}`}
        </strong>
        <span aria-hidden="true">idées</span>
      </p>
      <span aria-hidden="true" className="mx-1 h-7 w-px bg-content-muted/20" />
      {searching ? (
        <>
          <label htmlFor={searchId} className="sr-only">
            Rechercher une idée
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            maxLength={100}
            // L'ouverture du champ est un geste explicite de mentalyas : le focus l'y suit.
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
            onBlur={() => search === '' && setSearching(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSearch('')
                setSearching(false)
              }
            }}
            placeholder="Rechercher…"
            className="h-9 w-44 rounded-xl bg-surface-raised px-3 text-xs"
          />
        </>
      ) : (
        <DockButton icon="search" label="Chercher" name="Rechercher une idée" onClick={() => setSearching(true)} />
      )}
      <div ref={filters.ref} className="relative">
        <DockButton
          icon="filter"
          label={filtered ? 'Filtré' : 'Filtrer'}
          name="Filtrer (nature, catégorie)"
          expanded={filters.open}
          onClick={filters.toggle}
        />
        {filters.open ? (
          <div className="absolute bottom-full left-1/2 mb-2 flex w-56 -translate-x-1/2 flex-col gap-2 rounded-xl bg-surface p-3 text-xs shadow-lg">
            <div className="flex flex-col gap-1">
              <span aria-hidden="true">Nature</span>
              <select
                aria-label="Filtrer par nature"
                value={filter.nature ?? ''}
                onChange={(event) => setOption('nature', event.target.value)}
                className="h-8 rounded-md bg-surface-raised px-2"
              >
                <option value="">Toutes natures</option>
                <option value="action">Action</option>
                <option value="reflection">Réflexion</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span aria-hidden="true">Catégorie</span>
              <select
                aria-label="Filtrer par catégorie"
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
            </div>
          </div>
        ) : null}
      </div>
      {openCards > 0 ? (
        <DockButton
          icon="cards"
          label={`Cartes (${openCards})`}
          name={`Fermer les cartes (${openCards})`}
          title="Ferme toutes les cartes de détails ouvertes"
          onClick={onCloseCards}
        />
      ) : null}
      {onImport === undefined ? null : (
        <DockButton
          icon="import"
          label="Reprendre"
          name="Reprendre un projet existant"
          title="Importer un projet écrit par d’autres pour le comprendre (dossier)"
          onClick={onImport}
        />
      )}
      <span aria-hidden="true" className="mx-1 h-7 w-px bg-content-muted/20" />
      <DockButton
        icon="reorder"
        label="Réorganiser"
        title="Les nœuds glissent vers l’autre disposition (plans transposés)"
        onClick={onReorder}
      />
      <DockButton icon="recenter" label="Recentrer" title="Recentrer sur le genesis du projet" onClick={onRecenter} />
    </div>
  )
})
