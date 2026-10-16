import { useMutation, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { GitBranchView } from '@shared/git/model'
import { BranchName } from '@shared/git/model'
import { AGENT_BRANCH_PREFIX } from '@shared/agents/pipeline'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys, useRefreshGit } from './gitQueries'

/** Branche d'un agent (`agents/<tâche>/<agent>`, L1o D3) : son agent et sa tâche ; `null` pour une autre branche. */
function agentOf(name: string): { readonly agent: string; readonly task: string } | null {
  const [prefix, task, agent, ...rest] = name.split('/')
  return prefix === AGENT_BRANCH_PREFIX && task !== undefined && agent !== undefined && rest.length === 0
    ? { agent, task }
    : null
}

/** Avance et retard sur la branche suivie, en pastilles. */
function Sync({ branch }: { readonly branch: GitBranchView }): React.JSX.Element | null {
  if (branch.ahead === 0 && branch.behind === 0) return null
  return (
    <span className="flex shrink-0 gap-1 text-[11px] text-content-muted">
      {branch.ahead > 0 ? <span title="Commits à pousser">↑{branch.ahead}</span> : null}
      {branch.behind > 0 ? <span title="Commits à tirer">↓{branch.behind}</span> : null}
    </span>
  )
}

function BranchRow({
  branch,
  label,
  detail,
  disabled,
  onSwitch
}: {
  readonly branch: GitBranchView
  readonly label: string
  readonly detail?: string
  readonly disabled: boolean
  readonly onSwitch: (name: string) => void
}): React.JSX.Element {
  return (
    <li className="flex min-h-9 items-center gap-2 rounded-md px-2 hover:bg-surface-raised">
      <span className="min-w-0 flex-1 truncate" title={branch.name}>
        <span className="font-mono text-xs">{label}</span>
        {detail === undefined ? null : <span className="ml-2 text-xs text-content-muted">{detail}</span>}
      </span>
      <Sync branch={branch} />
      <Button
        className="!h-7 shrink-0 !px-3 text-xs"
        aria-label={`Passer sur ${branch.name}`}
        title={`Passer sur ${branch.name}`}
        disabled={disabled}
        onClick={() => onSwitch(branch.name)}
      >
        Passer
      </Button>
    </li>
  )
}

/**
 * Branches locales : la courante en tête, les autres avec « Passer », puis les branches des agents regroupées (repliées
 * d'office) et lisibles comme « agent · tâche ». Le nom complet reste au survol et pour les lecteurs d'écran.
 */
function BranchList({
  branches,
  disabled,
  onSwitch
}: {
  readonly branches: readonly GitBranchView[]
  readonly disabled: boolean
  readonly onSwitch: (name: string) => void
}): React.JSX.Element {
  const current = branches.find((branch) => branch.current)
  const others = branches.filter((branch) => !branch.current && agentOf(branch.name) === null)
  const agents = branches.filter((branch) => !branch.current && agentOf(branch.name) !== null)
  return (
    <div className="flex flex-col gap-2">
      {current === undefined ? null : (
        <div className="flex min-h-9 items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-2">
          <span aria-hidden="true" className="text-accent">
            ●
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold" title={current.name}>
            {current.name}
          </span>
          <Sync branch={current} />
          <span className="shrink-0 text-xs text-content-muted">branche courante</span>
        </div>
      )}
      {others.length === 0 ? null : (
        <ul aria-label="Branches locales" className="flex flex-col">
          {others.map((branch) => (
            <BranchRow
              key={branch.name}
              branch={branch}
              label={branch.name}
              {...(branch.upstream === null ? {} : { detail: `→ ${branch.upstream}` })}
              disabled={disabled}
              onSwitch={onSwitch}
            />
          ))}
        </ul>
      )}
      {agents.length === 0 ? null : (
        <details className="rounded-md border border-content-muted/20">
          <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-content-muted">
            Branches des agents ({agents.length})
          </summary>
          <ul aria-label="Branches des agents" className="flex flex-col pb-1">
            {agents.map((branch) => {
              const owner = agentOf(branch.name)
              return (
                <BranchRow
                  key={branch.name}
                  branch={branch}
                  label={owner?.agent ?? branch.name}
                  detail={owner?.task ?? ''}
                  disabled={disabled}
                  onSwitch={onSwitch}
                />
              )
            })}
          </ul>
        </details>
      )}
    </div>
  )
}

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
    mutationFn: ({ branch, confirm }: { readonly branch: string; readonly confirm?: true }) =>
      call('git:switchBranch', { genesisId, name: branch, ...(confirm === undefined ? {} : { confirm }) }),
    onSettled: () => refresh()
  })
  // Dépôt de l'app qui tourne : la branche demandée attend une confirmation.
  const appRepo =
    switchTo.error instanceof IpcFailure && switchTo.error.code === 'APP_REPO'
      ? (switchTo.variables?.branch ?? null)
      : null
  const valid = BranchName.safeParse(name).success
  const error = create.error ?? switchTo.error
  const dirtyFiles =
    error instanceof IpcFailure && Array.isArray(error.details?.['files']) ? (error.details['files'] as unknown[]) : []
  return (
    <div className="flex flex-col gap-3 text-sm">
      {query.data === undefined ? (
        <p className="text-content-muted">Lecture des branches…</p>
      ) : (
        <BranchList
          branches={query.data.local}
          disabled={readOnly || switchTo.isPending}
          onSwitch={(branch) => switchTo.mutate({ branch })}
        />
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
      {appRepo !== null ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-con/40 p-2 text-sm">
          <p>{switchTo.error?.message}</p>
          <div className="flex gap-2">
            <Button disabled={switchTo.isPending} onClick={() => switchTo.mutate({ branch: appRepo, confirm: true })}>
              Passer quand même sur {appRepo}
            </Button>
            <Button onClick={() => switchTo.reset()}>Rester ici</Button>
          </div>
        </div>
      ) : error === null ? null : (
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
