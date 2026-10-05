import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { HistoryEntryView, HistoryPageView } from '@shared/ipc/history'
import { useUiStore } from '../app/uiStore'
import { useUndo } from '../app/useUndo'
import { Button } from '../components/atoms/Button'
import { call } from '../lib/ipc'

const DATE = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : DATE.format(date)
}

function Row({ entry }: { readonly entry: HistoryEntryView }): React.JSX.Element {
  const undo = useUndo()
  const openChat = useUiStore((state) => state.openChat)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const label = entry.kind === 'undo' ? 'Rétablir' : 'Annuler'

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-raised px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className={entry.undone ? 'text-content-muted line-through' : ''}>{entry.summary}</p>
        <p className="text-xs text-content-muted">
          {formatDate(entry.at)}
          {entry.undone ? ' · annulé' : ''}
        </p>
        {message === null ? null : (
          <p role="alert" className="mt-1 text-xs">
            {message}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {entry.rootId === null ? null : (
          <Button onClick={() => openChat(entry.rootId as string)} aria-label={`Ouvrir l’idée : ${entry.summary}`}>
            Ouvrir
          </Button>
        )}
        {entry.undoable ? (
          <Button
            disabled={busy}
            aria-label={`${label} : ${entry.summary}`}
            onClick={() => {
              setBusy(true)
              setMessage(null)
              void undo(entry.batchId).then((outcome) => {
                setBusy(false)
                if (!outcome.ok) setMessage(outcome.message)
              })
            }}
          >
            {label}
          </Button>
        ) : null}
      </div>
    </li>
  )
}

/** Historique (FR-024) : changements du plus récent au plus ancien, annulables par lot, conflits expliqués. */
export function HistoryPage(): React.JSX.Element {
  const query = useInfiniteQuery({
    queryKey: ['history'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      call<HistoryPageView>('history:list', pageParam === null ? { limit: 30 } : { limit: 30, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor
  })
  const items = query.data?.pages.flatMap((page) => page.items) ?? []

  if (query.isError) {
    return (
      <p role="alert" className="p-8 text-center text-sm">
        L’historique n’a pas pu être chargé.
      </p>
    )
  }
  return (
    <div className="h-full overflow-auto p-4">
      {query.isPending ? (
        <p role="status" className="text-center text-sm text-content-muted">
          Chargement…
        </p>
      ) : items.length === 0 ? (
        <p className="p-8 text-center text-sm text-content-muted">
          Aucun changement pour l’instant. Les éclosions, les liens et les annulations apparaîtront ici.
        </p>
      ) : (
        <ul className="mx-auto max-w-3xl space-y-2">
          {items.map((entry) => (
            <Row key={entry.batchId} entry={entry} />
          ))}
        </ul>
      )}
      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            Voir plus
          </Button>
        </div>
      ) : null}
    </div>
  )
}
