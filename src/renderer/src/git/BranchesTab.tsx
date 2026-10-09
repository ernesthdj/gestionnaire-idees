import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { GitBranchView } from '@shared/git/model'
import { BranchName } from '@shared/git/model'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys, useRefreshGit } from './gitQueries'

interface BranchesView {
  readonly current: string | null
  readonly detached: boolean
  readonly local: readonly GitBranchView[]
  readonly remote: readonly GitBranchView[]
}

/**
 * Onglet Branches (spec 021 T016) : branches locales (la courante marquée), passer sur une autre, en créer une ; un
 * changement qui écraserait des fichiers modifiés est refusé avec la liste des fichiers.
 */
export function BranchesTab({
  genesisId,
  readOnly
}: {
  readonly genesisId: string
  readonly readOnly: boolean
}): React.JSX.Element {
  const refresh = useRefreshGit(genesisId)
  const nameId = useId()
  const [name, setName] = useState('')
  const query = useQuery({
    queryKey: gitKeys.branches(genesisId),
    queryFn: () => call<BranchesView>('git:branches', { genesisId })
  })
  const create = useMutation({
    mutationFn: () => call('git:createBranch', { genesisId, name }),
    onSuccess: () => setName(''),
    onSettled: () => refresh()
  })
  const switchTo = useMutation({
    mutationFn: (branch: string) => call('git:switchBranch', { genesisId, name: branch }),
    onSettled: () => refresh()
  })
  const valid = BranchName.safeParse(name).success
  const error = create.error ?? switchTo.error
  const dirtyFiles =
    error instanceof IpcFailure && Array.isArray(error.details?.['files']) ? (error.details['files'] as unknown[]) : []
  return (
    <div className="flex flex-col gap-3 text-sm">
      {query.data === undefined ? (
        <p className="text-content-muted">Lecture des branches…</p>
      ) : (
        <ul aria-label="Branches locales" className="flex flex-col gap-1">
          {query.data.local.map((branch) => (
            <li key={branch.name} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {branch.current ? '● ' : ''}
                {branch.name}
                {branch.upstream === null ? '' : ` → ${branch.upstream}`}
                {branch.ahead > 0 ? ` ↑${branch.ahead}` : ''}
                {branch.behind > 0 ? ` ↓${branch.behind}` : ''}
              </span>
              {branch.current ? (
                <span className="text-xs text-content-muted">branche courante</span>
              ) : (
                <button
                  type="button"
                  className="card-button card-button-ghost"
                  disabled={readOnly || switchTo.isPending}
                  onClick={() => switchTo.mutate(branch.name)}
                >
                  Passer sur {branch.name}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) create.mutate()
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={nameId} className="text-xs font-semibold text-content-muted">
            Nouvelle branche
          </label>
          <input
            id={nameId}
            value={name}
            disabled={readOnly}
            onChange={(event) => setName(event.target.value)}
            placeholder="feature/mon-sujet"
            aria-invalid={name !== '' && !valid}
            className="h-8 rounded-md border border-content-muted/30 bg-surface px-2 font-mono text-xs"
          />
        </div>
        <Button type="submit" disabled={readOnly || !valid || create.isPending}>
          Créer et y passer
        </Button>
      </form>
      {name !== '' && !valid ? (
        <p className="text-xs text-content-muted">
          Lettres, chiffres, « . _ / - » ; pas de « - » au début ni « analyste/ ».
        </p>
      ) : null}
      {error === null ? null : (
        <div role="alert" className="text-sm text-con">
          <p>{error instanceof IpcFailure ? error.message : 'L’opération a échoué.'}</p>
          {dirtyFiles.length === 0 ? null : (
            <ul className="mt-1 font-mono text-xs">
              {dirtyFiles.map((file) => (
                <li key={String(file)}>{String(file)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
