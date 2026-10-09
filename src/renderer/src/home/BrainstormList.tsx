import { useId, useState } from 'react'
import type { BrainstormListItem } from '@shared/ipc/brainstorms'

const LOCATION_TEXT: Readonly<Record<BrainstormListItem['location'], string>> = {
  vault: 'Coffre',
  external: 'Externe',
  local: 'Sans dossier'
}

const dateText = (iso: string | null): string | null => {
  if (iso === null) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Ligne d'information d'un brainstorm : emplacement, branche, dernière session. */
function metaOf(item: BrainstormListItem): string {
  const parts = [LOCATION_TEXT[item.location]]
  if (item.branch !== null) parts.push(`⎇ ${item.branch}`)
  const last = dateText(item.lastSession)
  parts.push(last === null ? 'jamais ouvert' : `dernière session ${last}`)
  if (item.id === null) parts.push('pas encore ouvert dans l’app')
  return parts.join(' · ')
}

/**
 * « Charger un brainstorm existant » (spec 024 US1, D6) : brainstorms de l'app et projets du coffre, avec une recherche ;
 * un dossier introuvable est grisé, une session `/hub` restée ouverte est signalée.
 */
export function BrainstormList({
  items,
  loading,
  busy,
  onOpen,
  onRelink
}: {
  readonly items: readonly BrainstormListItem[]
  readonly loading: boolean
  readonly busy: boolean
  readonly onOpen: (item: BrainstormListItem) => void
  /** « Relier » un projet en chantier déplacé (spec 024 US4). */
  readonly onRelink?: (item: BrainstormListItem) => void
}): React.JSX.Element {
  const id = useId()
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const shown =
    needle === ''
      ? items
      : items.filter((item) => `${item.name} ${item.slug} ${item.description}`.toLowerCase().includes(needle))

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-search`} className="sr-only">
        Rechercher un brainstorm
      </label>
      <input
        id={`${id}-search`}
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Rechercher un projet…"
        className="h-10 rounded-md border border-content-muted/30 bg-surface px-3 text-sm"
      />
      {loading ? (
        <p className="text-sm text-content-muted">Lecture des projets…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-content-muted">
          {items.length === 0
            ? 'Aucun brainstorm pour l’instant : commence par « Nouveau brainstorm ».'
            : 'Aucun projet ne correspond à la recherche.'}
        </p>
      ) : (
        <ul aria-label="Brainstorms" className="flex flex-col gap-2">
          {shown.map((item) => (
            <li key={item.id ?? `hub:${item.slug}`} className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || item.folderMissing}
                onClick={() => onOpen(item)}
                aria-label={`Ouvrir ${item.name}`}
                className="flex w-full items-start gap-3 rounded-lg border border-content-muted/20 px-4 py-3 text-left transition-colors duration-150 hover:border-accent/60 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{item.name}</span>
                    {item.openSession ? (
                      <span className="shrink-0 rounded-full border border-action/60 px-2 text-xs text-action">
                        session ouverte
                      </span>
                    ) : null}
                  </span>
                  {item.description === '' ? null : (
                    <span className="line-clamp-2 text-xs text-content-muted">{item.description}</span>
                  )}
                  <span className="text-xs text-content-muted">
                    {item.folderMissing ? 'dossier introuvable' : metaOf(item)}
                  </span>
                </span>
              </button>
              {item.folderMissing && item.location === 'external' && item.id !== null && onRelink !== undefined ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRelink(item)}
                  aria-label={`Relier ${item.name} à son nouveau dossier`}
                  className="h-8 shrink-0 rounded-md border border-content-muted/40 px-3 text-sm hover:bg-surface-raised disabled:opacity-50"
                >
                  Relier…
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
