import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import type { PublishPreviewView } from '@shared/git/sync'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys } from './gitQueries'

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'La publication a échoué.')
const REPO_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/

/**
 * Publier sur GitHub (spec 021 US2, E3) : compte connecté, nom, description, **Privé** coché par défaut ; Public demande
 * une seconde confirmation ; un fichier sensible dans l'historique bloque sans contournement ; `.gitignore` proposé s'il
 * manque. Sans `gh` ou non connecté : la commande à lancer, à copier.
 */
export function PublishPanel({
  genesisId,
  onClose
}: {
  readonly genesisId: string
  readonly onClose: () => void
}): React.JSX.Element {
  const id = useId()
  const client = useQueryClient()
  const refresh = (): void => void client.invalidateQueries({ queryKey: gitKeys.all(genesisId) })
  const preview = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'publishPreview'],
    queryFn: () => call<PublishPreviewView>('git:publishPreview', { genesisId }),
    retry: false,
    staleTime: 0
  })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [confirmPublic, setConfirmPublic] = useState(false)
  useEffect(() => {
    if (preview.data !== undefined && name === '') setName(preview.data.suggestedName)
  }, [preview.data, name])
  const gitignore = useMutation({ mutationFn: () => call('git:addGitignore', { genesisId }), onSuccess: refresh })
  const publish = useMutation({
    mutationFn: (view: PublishPreviewView) =>
      call<{ githubRepo: string; url: string }>('git:publish', {
        genesisId,
        name,
        description,
        visibility,
        confirm: true,
        ...(visibility === 'public' && confirmPublic ? { confirmPublic: true } : {}),
        expectedHead: view.head
      }),
    onSettled: refresh
  })
  const view = preview.data
  const missingGh =
    preview.error instanceof IpcFailure && ['GH_MISSING', 'GH_NOT_LOGGED_IN'].includes(preview.error.code)
  const ready =
    view !== undefined &&
    !view.blocked &&
    REPO_NAME.test(name) &&
    (visibility === 'private' || confirmPublic) &&
    !publish.isPending

  return (
    <section aria-labelledby={`${id}-title`} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm">
      <div className="flex items-center gap-2">
        <h3 id={`${id}-title`} className="flex-1 font-semibold">
          Publier sur GitHub
        </h3>
        <Button onClick={onClose}>Retour</Button>
      </div>
      {preview.error !== null ? (
        <div role="alert" className="flex flex-col gap-2 text-xs">
          <p className="text-con">{errorText(preview.error)}</p>
          {missingGh ? (
            <p className="flex items-center gap-2">
              <code className="rounded bg-surface-raised px-2 py-1">gh auth login</code>
              <Button onClick={() => void navigator.clipboard.writeText('gh auth login')}>Copier la commande</Button>
            </p>
          ) : null}
        </div>
      ) : view === undefined ? (
        <p className="text-content-muted">Contrôle avant publication…</p>
      ) : publish.data !== undefined ? (
        <p role="status">
          Publié : <span className="font-mono">{publish.data.githubRepo}</span> (
          {visibility === 'private' ? 'privé' : 'public'}).
        </p>
      ) : (
        <>
          <p className="text-xs text-content-muted">
            Compte <span className="font-semibold">{view.login}</span> · branche{' '}
            <span className="font-mono">{view.branch}</span> · {view.commitsToPush} commit(s)
          </p>
          {view.hasGitignore ? null : (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex-1">Pas de .gitignore : des fichiers inutiles ou privés pourraient partir.</span>
              <Button disabled={gitignore.isPending} onClick={() => gitignore.mutate()}>
                Ajouter le .gitignore
              </Button>
            </div>
          )}
          {view.blocked ? (
            <div role="alert" className="flex flex-col gap-1 rounded-md border border-con/50 p-2 text-xs">
              <p>Un fichier sensible est dans l’historique : rien n’est publié. Retire-le de l’historique d’abord.</p>
              <ul className="font-mono">
                {view.findings
                  .filter((finding) => finding.blocking)
                  .map((finding) => (
                    <li key={finding.id}>{finding.path}</li>
                  ))}
              </ul>
            </div>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Nom du dépôt</span>
            <input
              value={name}
              maxLength={100}
              aria-invalid={name !== '' && !REPO_NAME.test(name)}
              onChange={(event) => setName(event.target.value)}
              className="h-8 rounded-md border border-content-muted/30 bg-surface px-2 font-mono text-xs"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Description</span>
            <input
              value={description}
              maxLength={350}
              onChange={(event) => setDescription(event.target.value)}
              className="h-8 rounded-md border border-content-muted/30 bg-surface px-2"
            />
          </label>
          <fieldset className="flex flex-col gap-1 text-xs">
            <legend className="font-semibold">Visibilité</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`${id}-visibility`}
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
              />
              Privé (seul toi et les personnes invitées le voient)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`${id}-visibility`}
                checked={visibility === 'public'}
                onChange={() => {
                  setVisibility('public')
                  setConfirmPublic(false)
                }}
              />
              Public (visible par tout le monde)
            </label>
            {visibility === 'public' ? (
              <label className="ml-6 flex items-center gap-2 text-action">
                <input
                  type="checkbox"
                  checked={confirmPublic}
                  onChange={(event) => setConfirmPublic(event.target.checked)}
                />
                Je confirme : tout l’historique de ce dépôt sera visible par tout le monde
              </label>
            ) : null}
          </fieldset>
          {publish.error === null ? null : (
            <p role="alert" className="text-xs text-con">
              {errorText(publish.error)}
            </p>
          )}
          <div>
            <Button variant="primary" disabled={!ready} onClick={() => publish.mutate(view)}>
              {publish.isPending ? 'Publication…' : 'Publier'}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
