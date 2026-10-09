import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { GitStatusView } from '@shared/git/model'
import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys } from './gitQueries'

type PullResult = {
  readonly result: 'up_to_date' | 'fast_forward' | 'diverged'
  readonly incoming: number
  readonly upstreamHead?: string
}

/** Âge d'une vérification du distant, en mots. */
export function checkedAgo(iso: string | null, now = Date.now()): string {
  if (iso === null) return 'distant jamais vérifié'
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'vérifié à l’instant'
  if (minutes < 60) return `vérifié il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `vérifié il y a ${hours} h` : `vérifié il y a ${Math.round(hours / 24)} j`
}

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'L’opération a échoué.')

/**
 * Barre de synchronisation du volet Dépôt (spec 021 US2) : « ↓ Tirer (n) », « ↑ Pousser (n) », l'âge de la dernière
 * vérification et ⟳ ; « Publier sur GitHub » pour un dépôt sans distant suivi. Le distant est vérifié à l'ouverture du
 * volet (une fois) et sur ⟳ ; tirer ne fusionne deux historiques qu'après confirmation.
 */
export function SyncBar({
  genesisId,
  status,
  readOnly,
  onPush,
  onPublish
}: {
  readonly genesisId: string
  readonly status: GitStatusView
  readonly readOnly: boolean
  readonly onPush: () => void
  readonly onPublish: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const refresh = (): void => void client.invalidateQueries({ queryKey: gitKeys.all(genesisId) })
  const [diverged, setDiverged] = useState<{ readonly incoming: number; readonly upstreamHead: string } | null>(null)
  const [notice, setNotice] = useState('')
  const fetch = useMutation({
    mutationFn: () => call<GitStatusView>('git:fetch', { genesisId }),
    onSettled: refresh
  })
  const pull = useMutation({
    mutationFn: () => call<PullResult>('git:pull', { genesisId, confirm: true }),
    onSuccess: (result) => {
      if (result.result === 'diverged' && result.upstreamHead !== undefined) {
        setDiverged({ incoming: result.incoming, upstreamHead: result.upstreamHead })
      } else {
        setNotice(result.result === 'up_to_date' ? 'Déjà à jour.' : `${result.incoming} commit(s) tiré(s).`)
      }
    },
    onSettled: refresh
  })
  const merge = useMutation({
    mutationFn: (upstreamHead: string) =>
      call<{ result: 'merged' | 'conflicts'; hash: string }>('git:merge', {
        genesisId,
        confirm: true,
        expectedUpstreamHead: upstreamHead
      }),
    onSuccess: (result) => {
      setDiverged(null)
      if (result.result === 'conflicts') {
        // Conflits (US4) : la vue de résolution s'ouvre à la place de la carte.
        setNotice('Des fichiers sont en conflit : résous-les.')
        useUiStore.getState().openConflicts(genesisId)
      } else setNotice('Les deux historiques sont fusionnés.')
    },
    onSettled: refresh
  })

  // Vérification du distant à l'ouverture du volet, une fois, s'il y a une branche suivie.
  const checked = useRef(false)
  useEffect(() => {
    if (checked.current || status.upstream === null) return
    checked.current = true
    fetch.mutate()
  }, [status.upstream, fetch])

  const busy = fetch.isPending || pull.isPending || merge.isPending || readOnly
  const error = [fetch, pull, merge].find((mutation) => mutation.error !== null)?.error ?? null
  const noUpstream = status.upstream === null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button
          disabled={busy || noUpstream || status.behind === 0}
          onClick={() => pull.mutate()}
          title="Tirer : récupérer les commits du distant dans ta branche"
        >
          ↓ Tirer ({status.behind})
        </Button>
        <Button
          disabled={busy || (status.ahead === 0 && !noUpstream)}
          onClick={onPush}
          title="Pousser : envoyer tes commits sur le distant, après un aperçu"
        >
          ↑ Pousser{noUpstream ? '' : ` (${status.ahead})`}
        </Button>
        {noUpstream && status.github === null ? (
          <Button
            disabled={busy}
            onClick={onPublish}
            title="Créer le dépôt sur GitHub (privé par défaut) et y pousser ta branche"
          >
            Publier sur GitHub…
          </Button>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          <span className="text-content-muted">
            {fetch.isPending ? 'vérification…' : checkedAgo(status.lastFetchAt)}
          </span>
          <Button
            className="!px-2"
            disabled={busy || noUpstream}
            onClick={() => fetch.mutate()}
            aria-label="Vérifier le distant"
            title="Vérifier le distant (git fetch)"
          >
            ⟳
          </Button>
        </span>
      </div>
      {diverged === null ? null : (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-action/50 p-2 text-xs">
          <p>
            Le distant a {diverged.incoming} commit(s) que tu n’as pas, et tu en as qu’il n’a pas : les deux historiques
            ont divergé. Les fusionner crée un commit de fusion.
          </p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => merge.mutate(diverged.upstreamHead)}>
              Fusionner les deux historiques
            </Button>
            <Button onClick={() => setDiverged(null)}>Plus tard</Button>
          </div>
        </div>
      )}
      {notice === '' ? null : (
        <p role="status" className="text-xs">
          {notice}
        </p>
      )}
      {error === null ? null : (
        <p role="alert" className="text-xs text-con">
          {errorText(error)}
        </p>
      )}
    </div>
  )
}
