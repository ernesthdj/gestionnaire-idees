import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ForkPreviewView } from '@shared/git/github'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys } from './gitQueries'

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'Le fork a échoué.')

/**
 * Forker un dépôt d'autrui (spec 021 US6-5, L4g P6) : récapitulatif (« origin → ton fork, upstream → l'original »), puis
 * un clic crée le fork sur le compte connecté (ou réutilise celui qui existe) et règle les remotes.
 */
export function ForkDialog({
  genesisId,
  onDone
}: {
  readonly genesisId: string
  readonly onDone: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const preview = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'forkPreview'],
    queryFn: () => call<ForkPreviewView>('git:forkPreview', { genesisId }),
    retry: false
  })
  const fork = useMutation({
    mutationFn: () => call<{ readonly fork: string }>('git:fork', { genesisId, confirm: true }),
    onSuccess: () => void client.invalidateQueries({ queryKey: gitKeys.all(genesisId) })
  })
  const view = preview.data
  const error = preview.error ?? fork.error
  return (
    <section
      aria-label="Forker le dépôt"
      className="flex flex-col gap-2 rounded-md border border-accent/40 p-2 text-xs"
    >
      {fork.data !== undefined ? (
        <>
          <p role="status">
            Fork prêt : <span className="font-mono">origin</span> → {fork.data.fork}. Pousse ta branche, puis propose
            une PR depuis l’onglet PR.
          </p>
          <Button className="self-start" onClick={onDone}>
            Fermer
          </Button>
        </>
      ) : view === undefined ? (
        <p className="text-content-muted">{error === null ? 'Préparation du fork…' : ''}</p>
      ) : (
        <>
          <p className="font-semibold">Forker {view.source} sur ton compte</p>
          <ul className="font-mono">
            <li>origin → {view.target} (ton fork)</li>
            <li>upstream → {view.source} (l’original)</li>
          </ul>
          {view.alreadyForked ? <p>Ce fork existe déjà : il sera réutilisé.</p> : null}
          <div className="flex gap-2">
            <Button variant="primary" disabled={fork.isPending} onClick={() => fork.mutate()}>
              {fork.isPending ? 'Fork…' : 'Forker'}
            </Button>
            <Button onClick={onDone}>Annuler</Button>
          </div>
        </>
      )}
      {error === null ? null : (
        <p role="alert" className="text-con">
          {errorText(error)}
        </p>
      )}
    </section>
  )
}
