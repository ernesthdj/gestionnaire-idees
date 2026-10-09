import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import type { ConflictFileView, ConflictHunkView, HunkChoice, MergeStateView } from '@shared/git/conflicts'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys } from './gitQueries'

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'L’opération a échoué.')

const KIND_TEXT: Readonly<Record<MergeStateView['files'][number]['kind'], string>> = {
  content: 'texte',
  add_add: 'ajouté des deux côtés',
  delete_modify: 'supprimé d’un côté',
  binary: 'binaire ou trop grand'
}

const CHOICES: readonly { readonly choice: HunkChoice; readonly label: string }[] = [
  { choice: 'ours', label: 'Ta version' },
  { choice: 'theirs', label: 'Leur version' },
  { choice: 'both', label: 'Les deux' },
  { choice: 'claude', label: 'Proposition de Claude' },
  { choice: 'manual', label: 'Éditer' }
]

function Column({ title, text }: { readonly title: string; readonly text: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-xs font-semibold text-content-muted">{title}</p>
      <pre className="max-h-48 overflow-auto rounded bg-surface-raised p-2 text-xs">
        {text === '' ? '(vide)' : text}
      </pre>
    </div>
  )
}

/** Un bloc en conflit : les deux versions, la proposition de Claude (lignes nouvelles signalées), le choix. */
function HunkCard({
  hunk,
  disabled,
  onDecide
}: {
  readonly hunk: ConflictHunkView
  readonly disabled: boolean
  readonly onDecide: (choice: HunkChoice, manualText?: string) => void
}): React.JSX.Element {
  const id = useId()
  const [draft, setDraft] = useState(hunk.manualText ?? hunk.proposal?.text ?? hunk.ours)
  const proposalLines = hunk.proposal?.text.split('\n') ?? []
  return (
    <section
      aria-label={`Bloc ${hunk.index + 1}`}
      className="flex flex-col gap-2 rounded-lg border border-content-muted/20 p-3"
    >
      <p className="text-xs font-semibold">
        Bloc {hunk.index + 1}
        {hunk.decision === undefined ? ' · à décider' : ' · décidé'}
      </p>
      <div className="flex gap-2">
        <Column title="Ta version" text={hunk.ours} />
        <Column title="Leur version" text={hunk.theirs} />
      </div>
      {hunk.proposal === undefined ? null : (
        <div className="flex flex-col gap-1 rounded-md border border-accent/40 p-2">
          <p className="text-xs font-semibold">
            Proposition de Claude · {hunk.proposal.confidence === 'sure' ? 'fusion évidente' : 'à vérifier'}
          </p>
          <p className="text-xs">{hunk.proposal.explanation}</p>
          <pre className="max-h-48 overflow-auto rounded bg-surface-raised p-2 text-xs">
            {proposalLines.map((line, index) => (
              <span key={index} className="block">
                {hunk.proposal?.newLines.includes(index) ? (
                  <span className="text-action">✦ {line} (ligne nouvelle)</span>
                ) : (
                  line
                )}
              </span>
            ))}
          </pre>
        </div>
      )}
      <fieldset className="flex flex-wrap gap-3 text-xs">
        <legend className="sr-only">Choix pour le bloc {hunk.index + 1}</legend>
        {CHOICES.map((entry) => (
          <label key={entry.choice} className="flex items-center gap-1">
            <input
              type="radio"
              name={`${id}-choice`}
              checked={hunk.decision === entry.choice}
              disabled={disabled || (entry.choice === 'claude' && hunk.proposal === undefined)}
              onChange={() => onDecide(entry.choice, entry.choice === 'manual' ? draft : undefined)}
            />
            {entry.label}
          </label>
        ))}
      </fieldset>
      {hunk.decision === 'manual' ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-manual`} className="text-xs font-semibold">
            Ton texte pour ce bloc
          </label>
          <textarea
            id={`${id}-manual`}
            value={draft}
            rows={4}
            onChange={(event) => setDraft(event.target.value)}
            className="rounded-md border border-content-muted/30 bg-surface p-2 font-mono text-xs"
          />
          <div>
            <Button disabled={disabled} onClick={() => onDecide('manual', draft)}>
              Garder ce texte
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Vue de résolution d'une fusion (spec 021 US4, E7) : remplace la carte ; la liste des fichiers en conflit, puis, pour
 * chaque fichier, les blocs (ta version, leur version, proposition de Claude) et un aperçu ; « Valider ce fichier »,
 * « Terminer la fusion » (grisé tant qu'un fichier reste) et « Abandonner la fusion » (confirmé).
 */
export function ConflictView({
  genesisId,
  onClose
}: {
  readonly genesisId: string
  readonly onClose: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const refresh = (): void => void client.invalidateQueries({ queryKey: gitKeys.all(genesisId) })
  const stateKey = [...gitKeys.all(genesisId), 'merge'] as const
  const state = useQuery({
    queryKey: stateKey,
    queryFn: () => call<MergeStateView>('git:mergeState', { genesisId }),
    retry: false
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmAbort, setConfirmAbort] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const files = state.data?.files ?? []
  const firstOpen = files.find((file) => file.state === 'unresolved')?.path ?? null
  useEffect(() => {
    if (selected === null || !files.some((file) => file.path === selected && file.state === 'unresolved')) {
      setSelected(firstOpen)
    }
  }, [firstOpen, files, selected])
  const fileKey = [...gitKeys.all(genesisId), 'conflict', selected ?? ''] as const
  const file = useQuery({
    queryKey: fileKey,
    queryFn: () => call<ConflictFileView>('git:conflictFile', { genesisId, path: selected }),
    enabled: selected !== null,
    retry: false
  })
  const setFile = (view: ConflictFileView): void => {
    client.setQueryData(fileKey, view)
  }
  const propose = useMutation({
    mutationFn: () => call<ConflictFileView>('git:conflictPropose', { genesisId, path: selected }),
    onSuccess: setFile
  })
  const decide = useMutation({
    mutationFn: (input: { readonly hunkIndex: number; readonly choice: HunkChoice; readonly manualText?: string }) =>
      call<ConflictFileView>('git:conflictDecide', { genesisId, path: selected, ...input }),
    onSuccess: setFile
  })
  const resolve = useMutation({
    mutationFn: (view: ConflictFileView) =>
      call<MergeStateView>('git:conflictResolveFile', {
        genesisId,
        path: view.path,
        expectedPreviewHash: view.previewHash,
        confirm: true
      }),
    onSuccess: (next) => client.setQueryData(stateKey, next)
  })
  const whole = useMutation({
    mutationFn: (choice: 'ours' | 'theirs' | 'delete') =>
      call<MergeStateView>('git:conflictWholeFile', { genesisId, path: selected, choice, confirm: true }),
    onSuccess: (next) => client.setQueryData(stateKey, next)
  })
  const finish = useMutation({
    mutationFn: () => call<{ hash: string }>('git:mergeFinish', { genesisId, confirm: true }),
    onSuccess: (result) => {
      setDone(`Fusion terminée (commit ${result.hash.slice(0, 7)}).`)
      refresh()
    }
  })
  const abort = useMutation({
    mutationFn: () => call('git:mergeAbort', { genesisId, confirm: true }),
    onSuccess: () => {
      setDone('Fusion abandonnée : le dépôt est revenu à son état d’avant.')
      refresh()
    }
  })
  const busy = [propose, decide, resolve, whole, finish, abort].some((mutation) => mutation.isPending)
  const error =
    [state, file].find((query) => query.error !== null)?.error ??
    [propose, decide, resolve, whole, finish, abort].find((mutation) => mutation.error !== null)?.error ??
    null
  const unresolved = files.filter((entry) => entry.state === 'unresolved').length
  const view = file.data

  return (
    <section aria-label="Résolution de la fusion" className="flex h-full min-h-0 flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-base font-semibold">
          ⚠ Fusion{state.data === undefined ? '' : ` de ${state.data.from} dans ${state.data.into}`}
        </h2>
        {done === null ? (
          <>
            <Button
              variant="primary"
              disabled={busy || unresolved > 0 || files.length === 0}
              onClick={() => finish.mutate()}
            >
              Terminer la fusion
            </Button>
            {confirmAbort ? (
              <>
                <Button variant="danger" disabled={busy} onClick={() => abort.mutate()}>
                  Confirmer l’abandon
                </Button>
                <Button onClick={() => setConfirmAbort(false)}>Non</Button>
              </>
            ) : (
              <Button disabled={busy} onClick={() => setConfirmAbort(true)}>
                Abandonner la fusion
              </Button>
            )}
          </>
        ) : null}
        <Button onClick={onClose}>Retour à la carte</Button>
      </header>
      {done === null ? null : (
        <p role="status" className="text-sm">
          {done}
        </p>
      )}
      {error === null ? null : (
        <p role="alert" className="text-sm text-con">
          {errorText(error)}
        </p>
      )}
      {done !== null ? null : (
        <div className="flex min-h-0 flex-1 gap-4">
          <nav aria-label="Fichiers en conflit" className="flex w-72 shrink-0 flex-col gap-1 overflow-y-auto">
            <p className="text-xs text-content-muted">
              {unresolved === 0 ? 'Tout est résolu : tu peux terminer.' : `${unresolved} fichier(s) à résoudre`}
            </p>
            {files.map((entry) => (
              <button
                key={entry.path}
                type="button"
                aria-current={selected === entry.path ? 'true' : undefined}
                disabled={entry.state === 'resolved'}
                onClick={() => setSelected(entry.path)}
                className={`rounded-md px-2 py-1 text-left text-xs ${
                  selected === entry.path ? 'bg-accent/15 font-semibold' : 'hover:bg-surface-raised'
                }`}
              >
                {entry.state === 'resolved' ? '✓' : '⚠'} <span className="font-mono">{entry.path}</span>
                <span className="block text-content-muted">
                  {entry.state === 'resolved' ? 'résolu' : KIND_TEXT[entry.kind]}
                </span>
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
            {view === undefined ? null : view.kind === 'binary' || view.kind === 'delete_modify' ? (
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  <span className="font-mono">{view.path}</span> : {KIND_TEXT[view.kind]}. Choisis une version entière.
                </p>
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={() => whole.mutate('ours')}>
                    Garder ta version
                  </Button>
                  <Button disabled={busy} onClick={() => whole.mutate('theirs')}>
                    Prendre leur version
                  </Button>
                  {view.kind === 'delete_modify' ? (
                    <Button disabled={busy} onClick={() => whole.mutate('delete')}>
                      Supprimer le fichier
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <p className="flex-1 font-mono text-sm">{view.path}</p>
                  <Button
                    disabled={busy || view.localOnly}
                    onClick={() => propose.mutate()}
                    title={view.localOnly ? 'Projet « Local uniquement » : rien n’est envoyé à Claude' : undefined}
                  >
                    {propose.isPending ? 'Claude lit le conflit…' : '✨ Demander à Claude'}
                  </Button>
                </div>
                {view.hunks.map((hunk) => (
                  <HunkCard
                    key={`${view.path}:${hunk.index}`}
                    hunk={hunk}
                    disabled={busy}
                    onDecide={(choice, manualText) =>
                      decide.mutate({
                        hunkIndex: hunk.index,
                        choice,
                        ...(manualText === undefined ? {} : { manualText })
                      })
                    }
                  />
                ))}
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold">Aperçu du fichier</p>
                  <pre
                    aria-label="Aperçu du fichier"
                    className="max-h-72 overflow-auto rounded bg-surface-raised p-2 text-xs"
                  >
                    {view.preview}
                  </pre>
                </div>
                <div>
                  <Button
                    variant="primary"
                    disabled={busy || view.hunks.some((hunk) => hunk.decision === undefined)}
                    onClick={() => resolve.mutate(view)}
                  >
                    Valider ce fichier
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
