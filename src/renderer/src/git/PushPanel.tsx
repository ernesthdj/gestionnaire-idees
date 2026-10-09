import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FindingView, PushBlock, PushPreviewView } from '@shared/git/sync'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys } from './gitQueries'

const BLOCKS: Readonly<Record<PushBlock, string>> = {
  SENSITIVE_IN_HISTORY:
    'Un fichier sensible est dans les commits à pousser. Retire-le de l’historique (en terminal) : l’app ne pousse jamais un secret.',
  THIRD_PARTY_DEFAULT_BRANCH:
    'C’est la branche principale d’un dépôt qui n’est pas à toi. Crée une branche (onglet Branches), pousse-la, puis propose une PR sur GitHub.',
  NO_WRITE_ACCESS: 'Tu n’as pas le droit d’écrire dans ce dépôt. Fais-en un fork sur GitHub (bientôt dans l’app).'
}

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'Le push a échoué.')

function FindingLine({
  finding,
  accepted,
  onToggle
}: {
  readonly finding: FindingView
  readonly accepted: boolean
  readonly onToggle: () => void
}): React.JSX.Element {
  return (
    <li className="flex flex-col gap-1 rounded-md border border-content-muted/20 p-2 text-xs">
      <span>
        <span className="font-mono">{finding.path}</span>
        {finding.line === undefined ? '' : ` · ligne ${finding.line}`} · {finding.reason}
      </span>
      {finding.excerpt === undefined ? null : <code className="text-content-muted">{finding.excerpt}</code>}
      {finding.blocking ? (
        <span className="text-con">Bloquant : jamais poussé.</span>
      ) : (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={accepted} onChange={onToggle} />
          Ce n’est pas un secret
        </label>
      )}
    </li>
  )
}

/**
 * Aperçu puis push (spec 021 US2, E4) : destination (adresse sans identifiant), branche, commits, constats du contrôle
 * des fichiers sensibles sur toute la plage, droits GitHub ; un blocage s'explique avec son action, sans contournement.
 */
export function PushPanel({
  genesisId,
  onClose
}: {
  readonly genesisId: string
  readonly onClose: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const [accepted, setAccepted] = useState<readonly string[]>([])
  const preview = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'pushPreview'],
    queryFn: () => call<PushPreviewView>('git:pushPreview', { genesisId }),
    retry: false,
    staleTime: 0
  })
  const push = useMutation({
    mutationFn: (view: PushPreviewView) =>
      call<{ pushed: number }>('git:push', {
        genesisId,
        confirm: true,
        expectedHead: view.head,
        expectedRemote: view.remote,
        expectedBranch: view.branch,
        acceptFindings: accepted
      }),
    onSettled: () => void client.invalidateQueries({ queryKey: gitKeys.all(genesisId) })
  })
  const view = preview.data
  const open = view?.findings.filter((finding) => !finding.blocking && !accepted.includes(finding.id)) ?? []

  return (
    <section aria-label="Pousser" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 font-semibold">Pousser</h3>
        <Button onClick={onClose}>Retour</Button>
      </div>
      {preview.error !== null ? (
        <p role="alert" className="text-con">
          {errorText(preview.error)}
        </p>
      ) : view === undefined ? (
        <p className="text-content-muted">Contrôle des commits à pousser…</p>
      ) : push.data !== undefined ? (
        <p role="status">
          {push.data.pushed} commit(s) poussé(s) vers <span className="font-mono">{view.targetBranch}</span>.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-content-muted">Destination</dt>
            <dd className="truncate font-mono">{view.remoteUrl}</dd>
            <dt className="text-content-muted">Branche</dt>
            <dd className="font-mono">
              {view.branch} → {view.targetBranch}
              {view.firstPush ? ' (première fois)' : ''}
            </dd>
            <dt className="text-content-muted">Droits</dt>
            <dd>
              {view.githubRepo === null
                ? 'hors GitHub : droits non vérifiés'
                : view.permission === 'unknown'
                  ? 'non vérifiés (gh non connecté)'
                  : view.ownedByViewer
                    ? 'ton dépôt'
                    : `droit ${view.permission}`}
            </dd>
          </dl>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold">
              {view.total} commit{view.total > 1 ? 's' : ''} à pousser
            </p>
            <ul aria-label="Commits à pousser" className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">
              {view.commits.map((entry) => (
                <li key={entry.hash} className="truncate">
                  <span className="font-mono text-content-muted">{entry.hash.slice(0, 7)}</span> {entry.subject}
                </li>
              ))}
            </ul>
          </div>
          {view.namesOnly ? (
            <p className="text-xs text-content-muted">
              Beaucoup de commits : seuls les noms de fichiers ont été contrôlés, pas leur contenu.
            </p>
          ) : null}
          {view.findings.length === 0 ? (
            <p className="text-xs text-pro">Aucun fichier sensible dans les commits à pousser.</p>
          ) : (
            <ul aria-label="Constats" className="flex flex-col gap-1">
              {view.findings.map((finding) => (
                <FindingLine
                  key={finding.id}
                  finding={finding}
                  accepted={accepted.includes(finding.id)}
                  onToggle={() =>
                    setAccepted((current) =>
                      current.includes(finding.id)
                        ? current.filter((id) => id !== finding.id)
                        : [...current, finding.id]
                    )
                  }
                />
              ))}
            </ul>
          )}
          {view.blocked === null ? null : (
            <p role="alert" className="rounded-md border border-con/50 p-2 text-xs">
              {BLOCKS[view.blocked]}
            </p>
          )}
          {push.error === null ? null : (
            <p role="alert" className="text-xs text-con">
              {errorText(push.error)}
              {push.error instanceof IpcFailure && push.error.code === 'NON_FAST_FORWARD' ? ' (bouton « Tirer »)' : ''}
            </p>
          )}
          <div>
            <Button
              variant="primary"
              disabled={view.blocked !== null || open.length > 0 || view.total === 0 || push.isPending}
              onClick={() => push.mutate(view)}
            >
              {push.isPending ? 'Push…' : `Pousser ${view.total} commit${view.total > 1 ? 's' : ''}`}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
