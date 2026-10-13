import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { IssueDetailView, IssueLinkView, IssueStateFilter, IssueView } from '@shared/git/github'
import type { TreeView } from '@shared/ipc/neurons'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { GitHubMarkdown, openGitHub } from './GitHubMarkdown'
import { gitKeys } from './gitQueries'

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'L’opération a échoué.')
const dateText = (iso: string): string => new Date(iso).toLocaleDateString('fr-BE', { dateStyle: 'medium' })

interface Idea {
  readonly id: string
  readonly title: string
}

/** Idées du projet (son genesis et ses neurones), pour relier une issue ou en créer une. */
function useIdeas(genesisId: string): readonly Idea[] {
  const tree = useQuery({
    queryKey: ['neuron', 'tree', genesisId],
    queryFn: () => call<TreeView>('neuron:getTree', { rootId: genesisId })
  })
  if (tree.data === undefined) return []
  return [
    { id: tree.data.root.id, title: tree.data.root.title },
    ...tree.data.neurons.map((neuron) => ({ id: neuron.id, title: neuron.title }))
  ]
}

function useLinks(genesisId: string): readonly IssueLinkView[] {
  const links = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'issueLinks'],
    queryFn: () => call<readonly IssueLinkView[]>('git:issueLinks', { genesisId })
  })
  return links.data ?? []
}

/**
 * Onglet Issues du volet Dépôt (spec 021 US6, T050) : les issues (recherche, état, pages de 100), leur détail en texte
 * sûr, les liens issue ↔ idée (gardés dans l'app, annulables depuis l'Historique) et « Nouvelle issue » (depuis une
 * idée : texte proposé par Claude, modifiable, créé sur clic après récapitulatif).
 */
export function IssuesTab({
  genesisId,
  readOnly
}: {
  readonly genesisId: string
  readonly readOnly: boolean
}): React.JSX.Element {
  const client = useQueryClient()
  const ids = { state: useId(), search: useId() }
  const [state, setState] = useState<IssueStateFilter>('open')
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const list = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'issues', state, search, page],
    queryFn: () =>
      call<{ readonly items: readonly IssueView[]; readonly more: boolean }>('git:issueList', {
        genesisId,
        state,
        page,
        ...(search === '' ? {} : { search })
      })
  })
  const refresh = useMutation({
    mutationFn: () =>
      call('git:issueList', { genesisId, state, page, fresh: true, ...(search === '' ? {} : { search }) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: [...gitKeys.all(genesisId), 'issues'] })
  })

  if (creating) return <NewIssue genesisId={genesisId} onDone={() => setCreating(false)} />
  if (selected !== null) {
    return <IssueDetail genesisId={genesisId} number={selected} readOnly={readOnly} onBack={() => setSelected(null)} />
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setSearch(typed.trim())
        }}
      >
        <label htmlFor={ids.state} className="text-xs">
          Issues
        </label>
        <select
          id={ids.state}
          value={state}
          onChange={(event) => {
            setPage(1)
            setState(event.target.value as IssueStateFilter)
          }}
          className="h-7 rounded-md bg-surface-raised px-1 text-xs"
        >
          <option value="open">ouvertes</option>
          <option value="closed">fermées</option>
          <option value="all">toutes</option>
        </select>
        <label htmlFor={ids.search} className="sr-only">
          Rechercher une issue
        </label>
        <input
          id={ids.search}
          type="search"
          value={typed}
          maxLength={200}
          placeholder="Rechercher…"
          onChange={(event) => setTyped(event.target.value)}
          className="h-7 w-40 rounded-md bg-surface-raised px-2 text-xs"
        />
        <Button type="submit">Chercher</Button>
        <Button disabled={refresh.isPending} onClick={() => refresh.mutate()}>
          Actualiser
        </Button>
        <Button variant="primary" className="ml-auto" disabled={readOnly} onClick={() => setCreating(true)}>
          Nouvelle issue
        </Button>
      </form>
      {list.error !== null ? (
        <p role="alert" className="text-xs text-con">
          {errorText(list.error)}
        </p>
      ) : list.data === undefined ? (
        <p className="text-xs text-content-muted">Lecture de GitHub…</p>
      ) : list.data.items.length === 0 ? (
        <p className="text-xs text-content-muted">Aucune issue.</p>
      ) : (
        <ul aria-label="Issues" className="flex flex-col gap-1">
          {list.data.items.map((issue) => (
            <li key={issue.number}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left hover:bg-surface-raised"
                onClick={() => setSelected(issue.number)}
              >
                <span className="font-mono text-xs text-content-muted">#{issue.number}</span> {issue.title}
                <span className="block text-xs text-content-muted">
                  {issue.author} · {issue.state === 'open' ? 'ouverte' : 'fermée'} · {dateText(issue.updatedAt)}
                  {issue.labels.length === 0 ? '' : ` · ${issue.labels.join(', ')}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        {page > 1 ? <Button onClick={() => setPage((value) => value - 1)}>Précédentes</Button> : null}
        {list.data?.more === true ? <Button onClick={() => setPage((value) => value + 1)}>Suivantes</Button> : null}
      </div>
    </div>
  )
}

function IssueDetail({
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
  const client = useQueryClient()
  const pickId = useId()
  const ideas = useIdeas(genesisId)
  const links = useLinks(genesisId).filter((link) => link.kind === 'issue' && link.number === number)
  const [pick, setPick] = useState('')
  const detail = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'issue', number],
    queryFn: () => call<IssueDetailView>('git:issueView', { genesisId, number })
  })
  const reload = (): void => void client.invalidateQueries({ queryKey: [...gitKeys.all(genesisId), 'issueLinks'] })
  const link = useMutation({
    mutationFn: (neuronId: string) => call('git:issueLink', { genesisId, kind: 'issue', number, neuronId }),
    onSuccess: () => {
      setPick('')
      reload()
    }
  })
  const unlink = useMutation({
    mutationFn: (neuronId: string) => call('git:issueUnlink', { genesisId, kind: 'issue', number, neuronId }),
    onSuccess: reload
  })
  const titleOf = (id: string): string => ideas.find((idea) => idea.id === id)?.title ?? 'idée'
  const issue = detail.data
  const error = [detail, link, unlink].find((entry) => entry.error !== null)?.error ?? null
  return (
    <article aria-label={`Issue #${number}`} className="flex flex-col gap-2 text-sm">
      <Button className="self-start" onClick={onBack}>
        ← Issues
      </Button>
      {issue === undefined ? null : (
        <>
          <h3 className="font-semibold">
            #{issue.number} {issue.title}
          </h3>
          <p className="text-xs text-content-muted">
            {issue.author} · {issue.state === 'open' ? 'ouverte' : 'fermée'}
            {issue.url === '' ? null : (
              <>
                {' · '}
                <button type="button" className="underline" onClick={() => openGitHub(issue.url)}>
                  Ouvrir sur GitHub
                </button>
              </>
            )}
          </p>
          <GitHubMarkdown text={issue.body} />
        </>
      )}
      <section aria-label="Idées reliées" className="flex flex-col gap-1 rounded-md border border-content-muted/20 p-2">
        <p className="text-xs font-semibold">Idées reliées (dans l’app seulement)</p>
        {links.length === 0 ? <p className="text-xs text-content-muted">Aucune.</p> : null}
        <ul className="flex flex-col gap-1 text-xs">
          {links.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <span className="flex-1">{titleOf(entry.neuronId)}</span>
              <Button disabled={readOnly || unlink.isPending} onClick={() => unlink.mutate(entry.neuronId)}>
                Délier
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <label htmlFor={pickId} className="sr-only">
            Idée à relier
          </label>
          <select
            id={pickId}
            value={pick}
            onChange={(event) => setPick(event.target.value)}
            className="h-7 min-w-0 flex-1 rounded-md bg-surface-raised px-1 text-xs"
          >
            <option value="">Choisir une idée…</option>
            {ideas
              .filter((idea) => !links.some((entry) => entry.neuronId === idea.id))
              .map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.title}
                </option>
              ))}
          </select>
          <Button disabled={readOnly || pick === '' || link.isPending} onClick={() => link.mutate(pick)}>
            Relier
          </Button>
        </div>
      </section>
      {error === null ? null : (
        <p role="alert" className="text-xs text-con">
          {errorText(error)}
        </p>
      )}
    </article>
  )
}

function NewIssue({
  genesisId,
  onDone
}: {
  readonly genesisId: string
  readonly onDone: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const ids = { from: useId(), title: useId(), body: useId() }
  const ideas = useIdeas(genesisId)
  const [from, setFrom] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const propose = useMutation({
    mutationFn: () =>
      call<{ readonly title: string; readonly body: string }>('git:issuePropose', { genesisId, neuronId: from }),
    onSuccess: (text) => {
      setTitle(text.title)
      setBody(text.body)
    }
  })
  const create = useMutation({
    mutationFn: () =>
      call<{ readonly number: number; readonly url: string }>('git:issueCreate', {
        genesisId,
        title,
        body,
        confirm: true,
        ...(from === '' ? {} : { fromNeuronId: from })
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: gitKeys.all(genesisId) })
  })
  const error = [propose, create].find((entry) => entry.error !== null)?.error ?? null
  if (create.data !== undefined) {
    const created = create.data
    return (
      <div role="status" className="flex flex-col gap-2 text-sm">
        <p>
          Issue #{created.number} créée{from === '' ? '' : ' et reliée à son idée'}.
        </p>
        {created.url === '' ? null : (
          <Button className="self-start" onClick={() => openGitHub(created.url)}>
            Ouvrir sur GitHub
          </Button>
        )}
        <Button className="self-start" onClick={onDone}>
          Retour aux issues
        </Button>
      </div>
    )
  }
  return (
    <form
      aria-label="Nouvelle issue"
      className="flex flex-col gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        setConfirming(true)
      }}
    >
      <label htmlFor={ids.from} className="text-xs">
        Depuis une idée (facultatif)
      </label>
      <div className="flex gap-2">
        <select
          id={ids.from}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md bg-surface-raised px-1 text-xs"
        >
          <option value="">Aucune</option>
          {ideas.map((idea) => (
            <option key={idea.id} value={idea.id}>
              {idea.title}
            </option>
          ))}
        </select>
        <Button disabled={from === '' || propose.isPending} onClick={() => propose.mutate()}>
          {propose.isPending ? 'Claude écrit…' : '✨ Proposer'}
        </Button>
      </div>
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
        rows={6}
        onChange={(event) => setBody(event.target.value)}
        className="rounded-md bg-surface-raised p-2 text-xs"
      />
      {confirming ? (
        <div
          role="alertdialog"
          aria-label="Récapitulatif de l’issue"
          className="flex flex-col gap-2 rounded-md border border-accent/40 p-2 text-xs"
        >
          <p>Créer sur GitHub l’issue « {title} » ?</p>
          <div className="flex gap-2">
            <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Création…' : 'Créer l’issue'}
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
