import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { GitDiffView, GitFileView, GitStatusView } from '@shared/git/model'
import { Button } from '../components/atoms/Button'
import { WindowedList } from '../components/WindowedList'
import { call, IpcFailure } from '../lib/ipc'
import { DiffView } from './DiffView'
import { gitKeys, useRefreshGit } from './gitQueries'

interface Proposal {
  readonly message: string
  readonly groups: readonly { readonly paths: readonly string[]; readonly message: string }[]
  readonly offFormat: boolean
}

const STATUS_TEXT: Readonly<Record<GitFileView['status'], string>> = {
  M: 'modifié',
  A: 'ajouté',
  D: 'supprimé',
  R: 'renommé',
  '?': 'nouveau',
  U: 'en conflit'
}

/** Au-delà, la liste est fenêtrée. */
const WINDOWED_FROM = 200
const ROW = 32

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'L’opération a échoué.')

/**
 * Onglet Changements du volet Dépôt (spec 021 T016, US1) : rien n'est coché d'office ; cocher prépare le fichier, un
 * fichier sensible est verrouillé avec sa raison ; un clic sur un nom montre son diff ; « Proposer un message » demande
 * un message à Claude, que mentalyas corrige ; « Commiter (n fichiers) » (ou `Ctrl+Entrée`) n'envoie que ce qu'il a vu.
 */
export function ChangesTab({
  genesisId,
  status,
  readOnly
}: {
  readonly genesisId: string
  readonly status: GitStatusView
  readonly readOnly: boolean
}): React.JSX.Element {
  const refresh = useRefreshGit(genesisId)
  const ids = { message: useId(), hook: useId() }
  const [message, setMessage] = useState('')
  const [shown, setShown] = useState<{ readonly path: string; readonly staged: boolean } | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  // Une ligne par fichier : préparé s'il l'est (même s'il a aussi des modifications non préparées).
  const files = [...new Map(status.files.map((file) => [file.path, file] as const)).values()].map((file) => ({
    ...file,
    staged: status.files.some((entry) => entry.path === file.path && entry.staged)
  }))
  const staged = files.filter((file) => file.staged).map((file) => file.path)
  const selectable = files.filter((file) => !file.sensitive)

  const toggle = useMutation({
    mutationFn: async ({ paths, stage }: { readonly paths: readonly string[]; readonly stage: boolean }) =>
      call<GitStatusView>(stage ? 'git:stage' : 'git:unstage', { genesisId, paths }),
    onSettled: () => refresh()
  })
  const propose = useMutation({
    mutationFn: () => call<Proposal>('git:proposeMessage', { genesisId }),
    onSuccess: (result) => {
      setProposal(result)
      if (result.message !== '') setMessage(result.message)
    }
  })
  const commit = useMutation({
    mutationFn: () =>
      call<{ hash: string; branch: string }>('git:commit', {
        genesisId,
        message,
        expectedStaged: staged,
        confirm: true
      }),
    onSuccess: () => {
      setMessage('')
      setProposal(null)
      setShown(null)
    },
    onSettled: () => refresh()
  })
  const diff = useQuery({
    queryKey: shown === null ? ['git', genesisId, 'diff', 'aucun'] : gitKeys.diff(genesisId, shown.path, shown.staged),
    queryFn: () =>
      call<GitDiffView>('git:diff', { genesisId, path: shown?.path ?? '', staged: shown?.staged ?? false }),
    enabled: shown !== null
  })
  const busy = toggle.isPending || commit.isPending || readOnly
  const canCommit = !busy && staged.length > 0 && message.trim() !== ''
  const hookOutput =
    commit.error instanceof IpcFailure && typeof commit.error.details?.['hookOutput'] === 'string'
      ? commit.error.details['hookOutput']
      : null

  const row = (file: (typeof files)[number]): React.JSX.Element => (
    <div className="flex h-8 items-center gap-2 px-1 text-sm">
      <input
        type="checkbox"
        checked={file.staged}
        disabled={file.sensitive || busy}
        aria-label={`${file.staged ? 'Retirer' : 'Préparer'} ${file.path}`}
        title={file.sensitive ? 'Fichier sensible : jamais commité ni lu par l’app.' : undefined}
        onChange={() => toggle.mutate({ paths: [file.path], stage: !file.staged })}
      />
      <button
        type="button"
        className={`min-w-0 flex-1 truncate rounded px-1 text-left font-mono text-xs hover:bg-surface-raised ${
          shown?.path === file.path ? 'bg-accent/15' : ''
        }`}
        aria-pressed={shown?.path === file.path}
        disabled={file.sensitive}
        title={file.origPath === undefined ? file.path : `${file.origPath} → ${file.path}`}
        onClick={() => setShown({ path: file.path, staged: file.staged })}
      >
        {file.path}
      </button>
      <span className="shrink-0 text-xs text-content-muted">
        {file.sensitive ? '🔒 sensible' : STATUS_TEXT[file.status]}
      </span>
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {files.length === 0 ? (
        <p className="text-sm text-content-muted">Rien à commiter : la copie de travail est propre.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex-1 text-content-muted">
              {files.length} fichier{files.length > 1 ? 's' : ''} · {staged.length} coché{staged.length > 1 ? 's' : ''}
              {status.filesTotal > status.files.length ? ` · liste limitée à ${status.files.length}` : ''}
            </span>
            <button
              type="button"
              className="card-button card-button-ghost"
              disabled={busy || selectable.length === 0}
              onClick={() =>
                staged.length === selectable.length
                  ? toggle.mutate({ paths: staged, stage: false })
                  : toggle.mutate({
                      paths: selectable.filter((file) => !file.staged).map((file) => file.path),
                      stage: true
                    })
              }
            >
              {staged.length === selectable.length && selectable.length > 0 ? 'Tout décocher' : 'Tout cocher'}
            </button>
          </div>
          {files.length > WINDOWED_FROM ? (
            <WindowedList items={files} rowHeight={ROW} height={320} label="Fichiers modifiés" renderRow={row} />
          ) : (
            <ul aria-label="Fichiers modifiés" className="max-h-80 overflow-y-auto">
              {files.map((file) => (
                <li key={file.path}>{row(file)}</li>
              ))}
            </ul>
          )}
          {toggle.error === null ? null : (
            <p role="alert" className="text-sm text-con">
              {errorText(toggle.error)}
            </p>
          )}
        </>
      )}
      {shown === null ? null : (
        <section aria-label={`Différences de ${shown.path}`} className="flex min-h-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-mono text-xs">{shown.path}</p>
            <button type="button" className="card-button card-button-ghost" onClick={() => setShown(null)}>
              Fermer le diff
            </button>
          </div>
          {diff.error !== null ? (
            <p role="alert" className="text-sm text-con">
              {errorText(diff.error)}
            </p>
          ) : diff.data === undefined ? (
            <p className="text-sm text-content-muted">Lecture du diff…</p>
          ) : (
            <div className="max-h-72 overflow-auto">
              <DiffView diff={diff.data} />
            </div>
          )}
        </section>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor={ids.message} className="flex-1 text-xs font-semibold text-content-muted">
            Message du commit
          </label>
          <button
            type="button"
            className="card-button card-button-ghost"
            disabled={busy || staged.length === 0 || propose.isPending}
            onClick={() => propose.mutate()}
          >
            {propose.isPending ? 'Claude écrit…' : '✨ Proposer un message'}
          </button>
        </div>
        <textarea
          id={ids.message}
          rows={3}
          value={message}
          disabled={readOnly}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.ctrlKey && canCommit) {
              event.preventDefault()
              commit.mutate()
            }
          }}
          className="w-full rounded-md border border-content-muted/30 bg-surface p-2 font-mono text-xs"
          placeholder="type(scope): ce qui change"
        />
        {proposal?.offFormat === true ? (
          <p className="text-xs text-content-muted">Ce message ne suit pas le format « type(scope): description ».</p>
        ) : null}
        {proposal !== null && proposal.groups.length > 1 ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-content-muted">
              Claude suggère de découper en {proposal.groups.length} commits
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
              {proposal.groups.map((group) => (
                <li key={group.message}>
                  <span className="font-mono">{group.message}</span>
                  <span className="text-content-muted"> — {group.paths.join(', ')}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {propose.error === null ? null : (
          <p role="alert" className="text-xs text-con">
            {errorText(propose.error)}
          </p>
        )}
        <Button variant="primary" disabled={!canCommit} onClick={() => commit.mutate()}>
          {commit.isPending ? 'Commit…' : `Commiter (${staged.length} fichier${staged.length > 1 ? 's' : ''})`}
        </Button>
        {commit.error === null ? null : (
          <div role="alert" className="flex flex-col gap-1 text-sm text-con">
            <p>{errorText(commit.error)}</p>
            {hookOutput === null ? null : (
              <pre
                aria-labelledby={ids.hook}
                className="max-h-40 overflow-auto rounded bg-surface-raised p-2 text-xs text-content"
              >
                <span id={ids.hook} className="sr-only">
                  Sortie du hook
                </span>
                {hookOutput}
              </pre>
            )}
          </div>
        )}
        {commit.data === undefined ? null : (
          <p role="status" className="text-sm">
            Commit <span className="font-mono">{commit.data.hash.slice(0, 7)}</span> sur{' '}
            <span className="font-mono">{commit.data.branch}</span>.
          </p>
        )}
      </div>
    </div>
  )
}
