import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { SavePointRestoredView, SavePointView } from '@shared/ipc/brainstorms'
import type { ViewState } from '@shared/brainstorms/viewState'
import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { flushViewState } from '../home/useBrainstorms'
import { call, IpcFailure } from '../lib/ipc'

const pointsKey = (brainstormId: string) => ['savepoints', brainstormId] as const

const dateText = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'L’opération a échoué.')

type Pending = { readonly kind: 'restore' | 'delete' | 'rename'; readonly id: string } | null

/**
 * Points de sauvegarde du brainstorm ouvert (spec 024 US2, D7) : poser un point nommé, revenir à un point (après
 * confirmation ; le retour est annulable), renommer, supprimer (après confirmation).
 */
export function SavePoints({ brainstormId }: { readonly brainstormId: string }): React.JSX.Element {
  const id = useId()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  const [renamed, setRenamed] = useState('')
  const [lastReturn, setLastReturn] = useState<{ readonly undoId: string; readonly name: string } | null>(null)
  const points = useQuery({
    queryKey: pointsKey(brainstormId),
    queryFn: () => call<SavePointView[]>('savepoints:list', { brainstormId })
  })
  const refresh = (): void => void client.invalidateQueries({ queryKey: pointsKey(brainstormId) })
  /** Le canevas vient d'être remplacé : sa vue revient, tout ce qui est lu de la carte se relit. */
  const replaced = (viewState: ViewState | null): void => {
    useUiStore.getState().applyViewState(viewState)
    void client.invalidateQueries()
  }

  const create = useMutation({
    mutationFn: async () => {
      // La vue du moment fait partie du point.
      await flushViewState()
      return call<SavePointView>('savepoints:create', { brainstormId, name: name.trim() })
    },
    onSuccess: () => {
      setName('')
      refresh()
    }
  })
  const restore = useMutation({
    mutationFn: async (point: SavePointView) => {
      await flushViewState()
      return { point, result: await call<SavePointRestoredView>('savepoints:restore', { id: point.id }) }
    },
    onSuccess: ({ point, result }) => {
      setPending(null)
      setLastReturn({ undoId: result.undoId, name: point.name })
      replaced(result.viewState)
    }
  })
  const undo = useMutation({
    mutationFn: (undoId: string) => call<{ viewState: ViewState | null }>('savepoints:undoRestore', { undoId }),
    onSuccess: (result) => {
      setLastReturn(null)
      replaced(result.viewState)
    }
  })
  const rename = useMutation({
    mutationFn: (input: { readonly id: string; readonly name: string }) => call('savepoints:rename', input),
    onSuccess: () => {
      setPending(null)
      refresh()
    }
  })
  const remove = useMutation({
    mutationFn: (pointId: string) => call('savepoints:delete', { id: pointId }),
    onSuccess: () => {
      setPending(null)
      refresh()
    }
  })
  const error = [create, restore, undo, rename, remove].find((mutation) => mutation.error !== null)?.error ?? null
  const list = points.data ?? []
  const busy = create.isPending || restore.isPending || undo.isPending || rename.isPending || remove.isPending

  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-2">
        {lastReturn === null ? null : (
          <Button disabled={busy} onClick={() => undo.mutate(lastReturn.undoId)}>
            ↶ Annuler le retour à « {lastReturn.name} »
          </Button>
        )}
        <Button aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((value) => !value)}>
          Points de sauvegarde ({list.length})
        </Button>
      </div>
      {!open ? null : (
        <section
          id={`${id}-panel`}
          aria-label="Points de sauvegarde"
          className="absolute right-0 top-10 z-30 flex w-96 flex-col gap-3 rounded-lg border border-content-muted/30 bg-surface p-4 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
          }}
        >
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (name.trim() !== '' && !busy) create.mutate()
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold">
              Nom du point
              <input
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="avant refonte"
                className="h-8 rounded-md border border-content-muted/30 bg-surface px-2 text-sm font-normal"
              />
            </label>
            <Button type="submit" variant="primary" disabled={name.trim() === '' || busy}>
              Poser
            </Button>
          </form>
          {error === null ? null : (
            <p role="alert" className="text-xs text-con">
              {errorText(error)}
            </p>
          )}
          {list.length === 0 ? (
            <p className="text-xs text-content-muted">
              Aucun point : le travail est déjà sauvegardé en continu ; un point garde un état nommé du canevas.
            </p>
          ) : (
            <ul aria-label="Points posés" className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {list.map((point) => (
                <li key={point.id} className="flex flex-col gap-1 rounded-md border border-content-muted/20 p-2">
                  {pending?.kind === 'rename' && pending.id === point.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        if (renamed.trim() !== '') rename.mutate({ id: point.id, name: renamed.trim() })
                      }}
                    >
                      <input
                        aria-label={`Nouveau nom de ${point.name}`}
                        value={renamed}
                        maxLength={80}
                        onChange={(event) => setRenamed(event.target.value)}
                        className="h-8 min-w-0 flex-1 rounded-md border border-content-muted/30 bg-surface px-2 text-sm"
                      />
                      <Button type="submit" disabled={renamed.trim() === '' || busy}>
                        OK
                      </Button>
                    </form>
                  ) : (
                    <p className="flex items-baseline gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-semibold">{point.name}</span>
                      <span className="shrink-0 text-xs text-content-muted">{dateText(point.createdAt)}</span>
                    </p>
                  )}
                  {pending?.kind === 'restore' && pending.id === point.id ? (
                    <div className="flex flex-col gap-2 text-xs">
                      <p>Le canevas actuel sera remplacé par celui de ce point. Tu pourras annuler ce retour.</p>
                      <div className="flex gap-2">
                        <Button variant="primary" disabled={busy} onClick={() => restore.mutate(point)}>
                          Confirmer le retour
                        </Button>
                        <Button onClick={() => setPending(null)}>Annuler</Button>
                      </div>
                    </div>
                  ) : pending?.kind === 'delete' && pending.id === point.id ? (
                    <div className="flex flex-col gap-2 text-xs">
                      <p>Supprimer ce point ? Le canevas n’est pas touché.</p>
                      <div className="flex gap-2">
                        <Button variant="danger" disabled={busy} onClick={() => remove.mutate(point.id)}>
                          Confirmer la suppression
                        </Button>
                        <Button onClick={() => setPending(null)}>Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        aria-label={`Revenir à ${point.name}`}
                        disabled={busy}
                        onClick={() => setPending({ kind: 'restore', id: point.id })}
                      >
                        Revenir
                      </Button>
                      <Button
                        aria-label={`Renommer ${point.name}`}
                        disabled={busy}
                        onClick={() => {
                          setRenamed(point.name)
                          setPending({ kind: 'rename', id: point.id })
                        }}
                      >
                        Renommer
                      </Button>
                      <Button
                        aria-label={`Supprimer ${point.name}`}
                        disabled={busy}
                        onClick={() => setPending({ kind: 'delete', id: point.id })}
                      >
                        Supprimer
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
