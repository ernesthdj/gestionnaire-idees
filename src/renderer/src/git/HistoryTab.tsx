import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { AuthorView, GitCommitView } from '@shared/git/model'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys, useRefreshGit } from './gitQueries'

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
  if (query.data.commits.length === 0) return <p className="text-sm text-content-muted">Aucun commit pour l’instant.</p>
  const authors = new Map(query.data.authors.map((author) => [author.key, author] as const))
  return (
    <div className="flex flex-col gap-2 text-sm">
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
