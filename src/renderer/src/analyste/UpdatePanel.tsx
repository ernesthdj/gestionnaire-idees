import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  UPDATE_CHECKS,
  type UpdateCheckName,
  type UpdateCheckStatus,
  type UpdateDiffView,
  type UpdateProgressEvent,
  type UpdateView
} from '@shared/ipc/analyste'
import { ChatPanel } from '../chat/ChatPanel'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

const CHECK_LABELS: Readonly<Record<UpdateCheckName, string>> = {
  typecheck: 'Types',
  lint: 'Style (lint)',
  prettier: 'Format',
  test: 'Tests'
}

const CHECK_STATUS: Readonly<Record<UpdateCheckStatus, { icon: string; label: string }>> = {
  pending: { icon: '·', label: 'en attente' },
  running: { icon: '⚙', label: 'en cours' },
  ok: { icon: '✓', label: 'réussie' },
  fail: { icon: '✕', label: 'en échec' }
}

const STEPS: readonly { readonly id: 'coding' | 'checks' | 'ready'; readonly label: string }[] = [
  { id: 'coding', label: 'Codage' },
  { id: 'checks', label: 'Vérifications' },
  { id: 'ready', label: 'Prête à garder' }
]

export const updateKey = (proposalId: string): readonly unknown[] => ['analyste', 'update', proposalId]

/**
 * Mise à jour d'une proposition (spec 019 US4, T035) : conversation de codage limitée à la copie de travail, puis
 * « Terminer le codage » (enregistrement + vérifications), changements, « Essayer » (commande du profil d'essai),
 * « Garder » (fusion, l'app se recharge) ou « Jeter » (copie et branche retirées).
 */
export function UpdatePanel({ proposalId }: { readonly proposalId: string }): React.JSX.Element {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: updateKey(proposalId),
    queryFn: () => call<UpdateView | null>('analyste:update:get', { proposalId })
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [diff, setDiff] = useState<UpdateDiffView | null>(null)
  const [trial, setTrial] = useState<{ command: string; folder: string } | null>(null)
  const [confirming, setConfirming] = useState<'keep' | 'discard' | null>(null)
  const update = query.data ?? null

  useEffect(
    () =>
      window.api.on('analyste:update:progress', (payload) => {
        const event = payload as UpdateProgressEvent
        if (update !== null && event.updateId === update.id) {
          void client.invalidateQueries({ queryKey: updateKey(proposalId) })
          if (event.step !== 'checks') void client.invalidateQueries({ queryKey: ['analyste', 'proposals'] })
        }
      }),
    [client, proposalId, update]
  )

  const act = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await action()
      await client.invalidateQueries({ queryKey: ['analyste'] })
    } catch (failure) {
      setError(failure instanceof IpcFailure ? failure.message : 'L’action a échoué.')
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  if (query.isPending) return <p className="text-sm text-content-muted">Lecture de la mise à jour…</p>
  if (update === null) return <p className="text-sm text-content-muted">Pas de mise à jour pour cette proposition.</p>
  if (update.status === 'kept' || update.status === 'reverted') {
    return <KeptUpdate update={update} busy={busy} error={error} act={act} />
  }

  const checksDone = UPDATE_CHECKS.every((name) => update.checks[name].status === 'ok')
  const checking = UPDATE_CHECKS.some((name) => update.checks[name].status === 'running')
  const coding = update.status === 'coding' || update.status === 'to_fix'
  const step = update.status === 'ready' ? 'ready' : checking ? 'checks' : 'coding'

  return (
    <section aria-label="Mise à jour" className="space-y-3 rounded-md border border-content-muted/30 p-3 text-sm">
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Étapes de la mise à jour">
        {STEPS.map((item) => (
          <li
            key={item.id}
            aria-current={item.id === step ? 'step' : undefined}
            className={`rounded-full px-2 py-0.5 ${item.id === step ? 'bg-accent/20 font-semibold' : 'bg-surface'}`}
          >
            {item.label}
          </li>
        ))}
      </ol>
      <p className="text-xs text-content-muted">
        Branche <code>{update.branch}</code> · copie de travail séparée : l’app ouverte n’est pas modifiée.
      </p>

      {update.conversationNeuronId === null || !coding ? null : (
        <div className="h-96 overflow-hidden rounded-md border border-content-muted/20">
          <ChatPanel neuronId={update.conversationNeuronId} onClose={() => undefined} />
        </div>
      )}

      <ul className="space-y-1" aria-label="Vérifications">
        {UPDATE_CHECKS.map((name) => {
          const check = update.checks[name]
          return (
            <li key={name}>
              <span aria-hidden="true">{CHECK_STATUS[check.status].icon} </span>
              {CHECK_LABELS[name]} : {CHECK_STATUS[check.status].label}
              {check.tail === undefined ? null : (
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface p-2 text-xs whitespace-pre-wrap">
                  {check.tail}
                </pre>
              )}
            </li>
          )
        })}
      </ul>

      {update.depsChanged ? (
        <p role="note" className="rounded-md border border-amber-600/50 p-2 text-xs">
          Dépendances modifiées : ouvre un terminal dans <code>{update.folder}</code>, lance <code>npm ci</code>, puis «
          Relancer les vérifications ». L’app n’installe rien elle-même.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {coding || update.status === 'ready' ? (
          <Button
            variant={coding ? 'primary' : 'secondary'}
            disabled={busy || checking}
            onClick={() => void act(async () => void (await call('analyste:update:finish', { updateId: update.id })))}
          >
            {update.status === 'coding' && UPDATE_CHECKS.every((n) => update.checks[n].status === 'pending')
              ? 'Terminer le codage et vérifier'
              : 'Relancer les vérifications'}
          </Button>
        ) : null}
        <Button
          disabled={busy}
          onClick={() =>
            void act(async () => setDiff(await call<UpdateDiffView>('analyste:update:diff', { updateId: update.id })))
          }
        >
          Voir les changements
        </Button>
        {update.status === 'ready' || update.status === 'to_fix' ? (
          <Button
            disabled={busy}
            onClick={() =>
              void act(async () =>
                setTrial(
                  await call<{ command: string; folder: string }>('analyste:update:try', { updateId: update.id })
                )
              )
            }
          >
            Essayer
          </Button>
        ) : null}
        <Button
          variant="primary"
          disabled={busy || update.status !== 'ready' || !checksDone}
          onClick={() => setConfirming('keep')}
        >
          Garder…
        </Button>
        <Button
          variant="danger"
          disabled={busy || update.status === 'keeping'}
          onClick={() => setConfirming('discard')}
        >
          Jeter…
        </Button>
      </div>

      {confirming === null ? null : (
        <div role="alert" className="space-y-2 rounded-md border border-red-500/40 p-2 text-xs">
          <p>
            {confirming === 'keep'
              ? 'Fusionner la branche dans la branche de base ? Rien n’est publié. L’app va se recharger avec la nouvelle version.'
              : 'Jeter cette mise à jour ? La copie de travail et la branche sont supprimées, y compris le travail non enregistré ; rien d’autre n’est touché.'}
          </p>
          <div className="flex gap-2">
            <Button autoFocus onClick={() => setConfirming(null)}>
              Annuler
            </Button>
            <Button
              variant={confirming === 'keep' ? 'primary' : 'danger'}
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await call(confirming === 'keep' ? 'analyste:update:keep' : 'analyste:update:discard', {
                    updateId: update.id,
                    confirm: true
                  })
                })
              }
            >
              {confirming === 'keep' ? 'Garder' : 'Jeter'}
            </Button>
          </div>
        </div>
      )}

      {trial === null ? null : (
        <div className="space-y-1 rounded-md bg-surface p-2 text-xs">
          <p>
            Dans un terminal ouvert sur <code>{trial.folder}</code>, lance :
          </p>
          <p className="flex items-center gap-2">
            <code className="rounded bg-surface-raised px-2 py-1">{trial.command}</code>
            <Button onClick={() => void navigator.clipboard?.writeText(trial.command)}>Copier</Button>
          </p>
          <p className="text-content-muted">
            Profil d’essai fictif, recréé à chaque lancement, à côté de l’app ouverte.
          </p>
        </div>
      )}

      {diff === null ? null : (
        <div className="space-y-1">
          <ul className="text-xs" aria-label="Fichiers modifiés">
            {diff.files.length === 0 ? (
              <li className="text-content-muted">Aucun fichier enregistré pour l’instant.</li>
            ) : null}
            {diff.files.map((file) => (
              <li key={file.path} className="font-mono">
                {file.path} <span className="text-emerald-700 dark:text-emerald-400">+{file.added}</span>{' '}
                <span className="text-red-700 dark:text-red-400">−{file.removed}</span>
              </li>
            ))}
          </ul>
          {diff.patch === '' ? null : (
            <details>
              <summary className="cursor-pointer text-xs">
                Détail des lignes{diff.truncated ? ' (tronqué)' : ''}
              </summary>
              <pre className="max-h-96 overflow-auto rounded bg-surface p-2 text-xs">{diff.patch}</pre>
            </details>
          )}
        </div>
      )}

      {error === '' ? null : (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  )
}

/**
 * Mise à jour gardée (spec 019 US5, T037) : « Annuler cette mise à jour » ajoute un commit qui défait la fusion,
 * après confirmation ; une mise à jour annulée le reste.
 */
function KeptUpdate({
  update,
  busy,
  error,
  act
}: {
  readonly update: UpdateView
  readonly busy: boolean
  readonly error: string
  readonly act: (action: () => Promise<void>) => Promise<void>
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const reverted = update.status === 'reverted'
  return (
    <section aria-label="Mise à jour" className="space-y-3 rounded-md border border-content-muted/30 p-3 text-sm">
      <p>
        {reverted
          ? 'Mise à jour annulée : un commit a défait sa fusion, le code est revenu à l’état d’avant.'
          : 'Mise à jour gardée : sa branche a été fusionnée dans la branche de base (rien n’a été publié).'}
      </p>
      {reverted ? null : (
        <Button variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
          Annuler cette mise à jour…
        </Button>
      )}
      {confirming && !reverted ? (
        <div role="alert" className="space-y-2 rounded-md border border-red-500/40 p-2 text-xs">
          <p>
            Annuler cette mise à jour ? Un nouveau commit défait sa fusion ; l’historique garde les deux, rien n’est
            publié. L’app va se recharger avec le code d’avant.
          </p>
          <div className="flex gap-2">
            <Button autoFocus onClick={() => setConfirming(false)}>
              Ne pas annuler
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  setConfirming(false)
                  await call('analyste:update:revert', { updateId: update.id, confirm: true })
                })
              }
            >
              Annuler la mise à jour
            </Button>
          </div>
        </div>
      ) : null}
      {error === '' ? null : (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  )
}
