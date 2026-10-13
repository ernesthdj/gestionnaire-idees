import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { PrDetailView, PrReviewView, PrStateFilter, PrView } from '@shared/git/github'
import type { GitCommitView, GitStatusView } from '@shared/git/model'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { GitHubMarkdown, openGitHub } from './GitHubMarkdown'
import { gitKeys } from './gitQueries'

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'L’opération a échoué.')
const dateText = (iso: string): string => new Date(iso).toLocaleDateString('fr-BE', { dateStyle: 'medium' })
const STATES: Readonly<Record<PrView['state'], string>> = { open: 'ouverte', closed: 'fermée', merged: 'fusionnée' }
/** Lignes de diff montrées au plus (le reste s'ouvre sur GitHub). */
const DIFF_LINES = 400

/**
 * Onglet PR du volet Dépôt (spec 021 US6, T050) : les PR du dépôt GitHub (50 au plus), leur détail (description en
 * texte sûr, fichiers, diff), la relecture de Claude gardée dans l'app, un commentaire publié seulement après
 * relecture du texte et clic, la branche `pr/<n>` récupérée sans être lancée, et « Nouvelle PR » (texte proposé par
 * Claude, modifiable). Ni approbation ni fusion : elles se font sur GitHub.
 */
export function PrTab({
  genesisId,
  status,
  readOnly
}: {
  readonly genesisId: string
  readonly status: GitStatusView
  readonly readOnly: boolean
}): React.JSX.Element {
  const client = useQueryClient()
  const [state, setState] = useState<PrStateFilter>('open')
  const [selected, setSelected] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const stateId = useId()
  const list = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'prs', state],
    queryFn: () =>
      call<{ readonly items: readonly PrView[]; readonly more: boolean }>('git:prList', { genesisId, state })
  })
  const refresh = useMutation({
    mutationFn: () => call('git:prList', { genesisId, state, fresh: true }),
    onSuccess: () => void client.invalidateQueries({ queryKey: [...gitKeys.all(genesisId), 'prs'] })
  })

  if (creating) {
    return <NewPr genesisId={genesisId} status={status} onDone={() => setCreating(false)} />
  }
  if (selected !== null) {
    return <PrDetail genesisId={genesisId} number={selected} readOnly={readOnly} onBack={() => setSelected(null)} />
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={stateId} className="text-xs">
          PR
        </label>
        <select
          id={stateId}
          value={state}
          onChange={(event) => setState(event.target.value as PrStateFilter)}
          className="h-7 rounded-md bg-surface-raised px-1 text-xs"
        >
          <option value="open">ouvertes</option>
          <option value="merged">fusionnées</option>
          <option value="closed">fermées</option>
          <option value="all">toutes</option>
        </select>
        <Button disabled={refresh.isPending} onClick={() => refresh.mutate()}>
          Actualiser
        </Button>
        <Button
          variant="primary"
          className="ml-auto"
          disabled={readOnly || status.branch === null}
          onClick={() => setCreating(true)}
        >
          Nouvelle PR
        </Button>
      </div>
      {list.error !== null ? (
        <p role="alert" className="text-xs text-con">
          {errorText(list.error)}
        </p>
      ) : list.data === undefined ? (
        <p className="text-xs text-content-muted">Lecture de GitHub…</p>
      ) : list.data.items.length === 0 ? (
        <p className="text-xs text-content-muted">Aucune PR.</p>
      ) : (
        <ul aria-label="Pull requests" className="flex flex-col gap-1">
          {list.data.items.map((pr) => (
            <li key={pr.number}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left hover:bg-surface-raised"
                onClick={() => setSelected(pr.number)}
              >
                <span className="font-mono text-xs text-content-muted">#{pr.number}</span> {pr.title}
                <span className="block text-xs text-content-muted">
                  {pr.author} · {pr.head} → {pr.base} · {pr.draft ? 'brouillon' : STATES[pr.state]} ·{' '}
                  {dateText(pr.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.data?.more === true ? (
        <p className="text-xs text-content-muted">Les 50 plus récentes : la suite sur GitHub.</p>
      ) : null}
    </div>
  )
}

function DiffBlock({ diff, truncated }: { readonly diff: string; readonly truncated: boolean }): React.JSX.Element {
  const lines = diff.split('\n')
  return (
    <div className="flex flex-col gap-1">
      <pre aria-label="Diff de la PR" className="max-h-80 overflow-auto rounded-md bg-surface-raised p-2 text-[11px]">
        {lines.slice(0, DIFF_LINES).map((line, index) => (
          <span
            key={index}
            className={`block ${line.startsWith('+') ? 'text-pro' : line.startsWith('-') ? 'text-con' : ''}`}
          >
            {line === '' ? ' ' : line}
          </span>
        ))}
      </pre>
      {truncated || lines.length > DIFF_LINES ? (
        <p className="text-xs text-content-muted">Diff tronqué : la suite sur GitHub.</p>
      ) : null}
    </div>
  )
}

function PrDetail({
  genesisId,
  number,
  readOnly,
  onBack
}: {
  readonly genesisId: string
  readonly number: number
  readonly readOnly: boolean
  readonly onBack: () => void
}): React.JSX.Element {
  const detail = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'pr', number],
    queryFn: () => call<PrDetailView>('git:prView', { genesisId, number })
  })
  const review = useMutation({ mutationFn: () => call<PrReviewView>('git:prReview', { genesisId, number }) })
  const fetchBranch = useMutation({
    mutationFn: () => call<{ readonly branch: string }>('git:prFetchBranch', { genesisId, number })
  })
  const [draft, setDraft] = useState<string | null>(null)
  const comment = useMutation({
    mutationFn: (body: string) =>
      call<{ readonly url: string }>('git:prComment', { genesisId, number, body, confirm: true }),
    onSuccess: () => setDraft(null)
  })
  const pr = detail.data
  const error = [detail, review, fetchBranch, comment].find((entry) => entry.error !== null)?.error ?? null
  return (
    <article aria-label={`PR #${number}`} className="flex flex-col gap-2 text-sm">
      <Button className="self-start" onClick={onBack}>
        ← PR
      </Button>
      {pr === undefined ? (
        <p className="text-xs text-content-muted">{detail.error === null ? 'Lecture de la PR…' : ''}</p>
      ) : (
        <>
          <h3 className="font-semibold">
            #{pr.number} {pr.title}
          </h3>
          <p className="text-xs text-content-muted">
            {pr.author} · {pr.head} → {pr.base} · {pr.draft ? 'brouillon' : STATES[pr.state]}
            {pr.url === '' ? null : (
              <>
                {' · '}
                <button type="button" className="underline" onClick={() => openGitHub(pr.url)}>
                  Ouvrir sur GitHub
                </button>
              </>
            )}
          </p>
          <GitHubMarkdown text={pr.body} />
          <details>
            <summary className="cursor-pointer text-xs">{pr.files.length} fichier(s) modifié(s)</summary>
            <ul className="text-xs">
              {pr.files.map((file) => (
                <li key={file.path} className="font-mono">
                  {file.path} <span className="text-pro">+{file.additions}</span>{' '}
                  <span className="text-con">-{file.deletions}</span>
                </li>
              ))}
            </ul>
          </details>
          <DiffBlock diff={pr.diff} truncated={pr.truncated} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={review.isPending} onClick={() => review.mutate()}>
              {review.isPending ? 'Claude relit…' : '✨ Relire avec Claude'}
            </Button>
            <Button disabled={readOnly || fetchBranch.isPending} onClick={() => fetchBranch.mutate()}>
              Récupérer la branche pr/{number}
            </Button>
          </div>
          {fetchBranch.data === undefined ? null : (
            <p role="status" className="text-xs">
              Branche {fetchBranch.data.branch} récupérée : rien n’a été lancé. Passe dessus depuis l’onglet Branches
              pour l’essayer.
            </p>
          )}
          {review.data === undefined ? null : (
            <section
              aria-label="Relecture de Claude"
              className="flex flex-col gap-2 rounded-md border border-accent/40 p-2"
            >
              <p className="text-xs font-semibold">Relecture de Claude (gardée dans l’app)</p>
              <p className="text-xs whitespace-pre-wrap">{review.data.summary}</p>
              <ul className="flex flex-col gap-1">
                {review.data.comments.map((entry, index) => {
                  const where =
                    entry.path === null ? '' : `${entry.path}${entry.line === null ? '' : `:${entry.line}`} — `
                  return (
                    <li key={index} className="flex items-start gap-2 text-xs">
                      <span className="flex-1">
                        <span className="font-mono">{where}</span>
                        {entry.text}
                      </span>
                      <Button disabled={readOnly} onClick={() => setDraft(`${where}${entry.text}`)}>
                        Commenter
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          <div className="flex flex-col gap-1">
            {draft === null ? (
              <Button className="self-start" disabled={readOnly} onClick={() => setDraft('')}>
                Écrire un commentaire
              </Button>
            ) : (
              <>
                <label className="text-xs" htmlFor={`commentaire-${number}`}>
                  Commentaire publié sur GitHub (relis-le)
                </label>
                <textarea
                  id={`commentaire-${number}`}
                  value={draft}
                  maxLength={20_000}
                  rows={4}
                  onChange={(event) => setDraft(event.target.value)}
                  className="rounded-md bg-surface-raised p-2 text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    disabled={draft.trim() === '' || comment.isPending}
                    onClick={() => comment.mutate(draft)}
                  >
                    Publier ce commentaire
                  </Button>
                  <Button onClick={() => setDraft(null)}>Annuler</Button>
                </div>
              </>
            )}
            {comment.data === undefined ? null : (
              <p role="status" className="text-xs">
                Commentaire publié.
              </p>
            )}
          </div>
        </>
      )}
      {error === null ? null : (
        <p role="alert" className="text-xs text-con">
          {errorText(error)}
        </p>
      )}
    </article>
  )
}

function NewPr({
  genesisId,
  status,
  onDone
}: {
  readonly genesisId: string
  readonly status: GitStatusView
  readonly onDone: () => void
}): React.JSX.Element {
  const ids = { base: useId(), title: useId(), body: useId() }
  const [base, setBase] = useState('main')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [draft, setDraft] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const log = useQuery({
    queryKey: gitKeys.log(genesisId),
    queryFn: () => call<{ readonly commits: readonly GitCommitView[] }>('git:log', { genesisId, limit: 50 })
  })
  const propose = useMutation({
    mutationFn: () => call<{ readonly title: string; readonly body: string }>('git:prPropose', { genesisId, base }),
    onSuccess: (text) => {
      setTitle(text.title)
      setBody(text.body)
    }
  })
  const create = useMutation({
    mutationFn: () =>
      call<{ readonly number: number; readonly url: string }>('git:prCreate', {
        genesisId,
        base,
        title,
        body,
        draft,
        confirm: true,
        expectedHead: log.data?.commits[0]?.hash ?? ''
      })
  })
  const error = [propose, create].find((entry) => entry.error !== null)?.error ?? null
  if (create.data !== undefined) {
    const created = create.data
    return (
      <div role="status" className="flex flex-col gap-2 text-sm">
        <p>PR #{created.number} créée.</p>
        {created.url === '' ? null : (
          <Button className="self-start" onClick={() => openGitHub(created.url)}>
            Ouvrir sur GitHub
          </Button>
        )}
        <Button className="self-start" onClick={onDone}>
          Retour aux PR
        </Button>
      </div>
    )
  }
  return (
    <form
      aria-label="Nouvelle PR"
      className="flex flex-col gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        setConfirming(true)
      }}
    >
      <p className="text-xs text-content-muted">
        Depuis la branche <span className="font-mono">{status.branch}</span> (poussée sur GitHub).
      </p>
      <label htmlFor={ids.base} className="text-xs">
        Vers la branche
      </label>
      <input
        id={ids.base}
        value={base}
        maxLength={200}
        onChange={(event) => setBase(event.target.value)}
        className="h-8 rounded-md bg-surface-raised px-2 text-xs"
      />
      <Button
        className="self-start"
        disabled={propose.isPending || base.trim() === ''}
        onClick={() => propose.mutate()}
      >
        {propose.isPending ? 'Claude écrit…' : '✨ Proposer le texte'}
      </Button>
      <label htmlFor={ids.title} className="text-xs">
        Titre
      </label>
      <input
        id={ids.title}
        value={title}
        maxLength={256}
        onChange={(event) => setTitle(event.target.value)}
        className="h-8 rounded-md bg-surface-raised px-2 text-xs"
      />
      <label htmlFor={ids.body} className="text-xs">
        Description
      </label>
      <textarea
        id={ids.body}
        value={body}
        maxLength={20_000}
        rows={8}
        onChange={(event) => setBody(event.target.value)}
        className="rounded-md bg-surface-raised p-2 text-xs"
      />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={draft} onChange={() => setDraft((value) => !value)} />
        Brouillon (draft)
      </label>
      {confirming ? (
        <div
          role="alertdialog"
          aria-label="Récapitulatif de la PR"
          className="flex flex-col gap-2 rounded-md border border-accent/40 p-2 text-xs"
        >
          <p>
            Créer sur GitHub la PR « {title} » de <span className="font-mono">{status.branch}</span> vers{' '}
            <span className="font-mono">{base}</span>
            {draft ? ' (brouillon)' : ''} ?
          </p>
          <div className="flex gap-2">
            <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Création…' : 'Créer la PR'}
            </Button>
            <Button onClick={() => setConfirming(false)}>Modifier</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={title.trim() === ''}>
            Vérifier et créer
          </Button>
          <Button onClick={onDone}>Annuler</Button>
        </div>
      )}
      {error === null ? null : (
        <p role="alert" className="text-xs text-con">
          {errorText(error)}
        </p>
      )}
    </form>
  )
}
