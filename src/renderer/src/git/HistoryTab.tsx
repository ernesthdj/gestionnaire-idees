import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { AuthorView, GitCommitView } from '@shared/git/model'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys, useRefreshGit } from './gitQueries'
import { Timeline } from './Timeline'

interface LogView {
  readonly commits: readonly GitCommitView[]
  readonly authors: readonly AuthorView[]
}

const dateText = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Onglet Historique (spec 021 T016) : les derniers commits (sujet, date, auteur en initiales), et « Annuler ce commit »
 * sur un commit simple : confirmé, il crée un commit d'annulation (jamais de réécriture d'historique).
 */
export function HistoryTab({
  genesisId,
  readOnly
}: {
  readonly genesisId: string
  readonly readOnly: boolean
}): React.JSX.Element {
  const refresh = useRefreshGit(genesisId)
  const [confirming, setConfirming] = useState<string | null>(null)
  const query = useQuery({
    queryKey: gitKeys.log(genesisId),
    queryFn: () => call<LogView>('git:log', { genesisId, limit: 50 })
  })
  const revert = useMutation({
    mutationFn: (hash: string) =>
      call('git:revert', { genesisId, hash, expectedHead: query.data?.commits[0]?.hash ?? hash, confirm: true }),
    onSettled: () => {
      setConfirming(null)
      void refresh()
    }
  })
  if (query.data === undefined) return <p className="text-sm text-content-muted">Lecture de l’historique…</p>
  if (query.data.commits.length === 0) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <SinceLastVisit genesisId={genesisId} />
        <Timeline genesisId={genesisId} readOnly={readOnly} />
        <p className="text-content-muted">Aucun commit pour l’instant.</p>
      </div>
    )
  }
  const authors = new Map(query.data.authors.map((author) => [author.key, author] as const))
  return (
    <div className="flex flex-col gap-2 text-sm">
      <SinceLastVisit genesisId={genesisId} />
      <Timeline genesisId={genesisId} readOnly={readOnly} />
      <ul aria-label="Derniers commits" className="flex flex-col gap-1">
        {query.data.commits.map((commit) => {
          const author = authors.get(commit.authorKey)
          return (
            <li key={commit.hash} className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: author?.color ?? 'var(--color-content-muted)' }}
                title={author?.name}
                aria-label={author === undefined ? 'Auteur inconnu' : `Auteur ${author.name}`}
              >
                {author?.initials ?? '?'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{commit.subject}</span>
                <span className="text-xs text-content-muted">
                  <span className="font-mono">{commit.hash.slice(0, 7)}</span> · {dateText(commit.date)}
                  {commit.isMerge ? ' · fusion' : ''}
                </span>
              </span>
              {commit.isMerge || readOnly ? null : confirming === commit.hash ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="card-button"
                    disabled={revert.isPending}
                    onClick={() => revert.mutate(commit.hash)}
                  >
                    Confirmer l’annulation
                  </button>
                  <button type="button" className="card-button card-button-ghost" onClick={() => setConfirming(null)}>
                    Garder
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="card-button card-button-ghost shrink-0"
                  aria-label={`Annuler le commit ${commit.subject}`}
                  onClick={() => setConfirming(commit.hash)}
                >
                  Annuler ce commit
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {revert.error === null ? null : (
        <p role="alert" className="text-sm text-con">
          {revert.error instanceof IpcFailure ? revert.error.message : 'L’annulation a échoué.'}
        </p>
      )}
    </div>
  )
}

interface UpdatesView extends LogView {
  readonly lastSeen: string | null
  readonly upstreamHead: string | null
}

/**
 * « Depuis ta dernière visite » (spec 021 US3) : les commits du distant arrivés depuis le dernier vu, jusqu'à « Marquer
 * comme vu ». Rien sans distant suivi ni référence (un projet cloné part du commit cloné).
 */
function SinceLastVisit({ genesisId }: { readonly genesisId: string }): React.JSX.Element | null {
  const refresh = useRefreshGit(genesisId)
  const updates = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'updates'],
    queryFn: () => call<UpdatesView>('git:updates', { genesisId }),
    retry: false
  })
  const seen = useMutation({
    mutationFn: (hash: string) => call('git:markSeen', { genesisId, hash }),
    onSettled: () => void refresh()
  })
  const data = updates.data
  if (data === undefined || data.commits.length === 0 || data.upstreamHead === null) return null
  const authors = new Map(data.authors.map((author) => [author.key, author] as const))
  const head = data.upstreamHead
  return (
    <section
      aria-label="Depuis ta dernière visite"
      className="flex flex-col gap-1 rounded-md border border-accent/40 p-2"
    >
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-semibold">
          ✦ Depuis ta dernière visite : {data.commits.length} commit{data.commits.length > 1 ? 's' : ''}
        </p>
        <button
          type="button"
          className="rounded-md border border-content-muted/40 px-2 py-1 text-xs hover:bg-surface-raised disabled:opacity-50"
          disabled={seen.isPending}
          onClick={() => seen.mutate(head)}
        >
          Marquer comme vu
        </button>
      </div>
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs">
        {data.commits.map((commit) => (
          <li key={commit.hash} className="truncate">
            <span className="font-mono text-content-muted">{commit.hash.slice(0, 7)}</span> {commit.subject}
            <span className="text-content-muted"> · {authors.get(commit.authorKey)?.name ?? 'auteur inconnu'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
