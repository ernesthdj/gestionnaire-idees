import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryView, StoryView } from '@shared/git/history'
import type { AuthorView, GitCommitView } from '@shared/git/model'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys } from './gitQueries'

type Zoom = 'semaine' | 'mois' | 'annee'
const SPANS: Readonly<Record<Zoom, number>> = { semaine: 7, mois: 31, annee: 366 }
const DAY = 24 * 60 * 60 * 1000
const PAGE = 5_000

const errorText = (error: unknown): string => (error instanceof IpcFailure ? error.message : 'L’opération a échoué.')
const dateText = (iso: string): string => new Date(iso).toLocaleDateString('fr-BE', { dateStyle: 'medium' })

/** Pseudonymes du récit (« Auteur A ») remplacés par les vrais noms, à l'affichage seulement. */
export function withRealNames(story: StoryView, authors: readonly AuthorView[]): string {
  const byKey = new Map(authors.map((author) => [author.key, author.name] as const))
  return Object.entries(story.names)
    .sort(([a], [b]) => b.length - a.length)
    .reduce((text, [alias, key]) => text.split(alias).join(byKey.get(key) ?? alias), story.text)
}

/** Écart minimal entre deux points d'une même ligne, et marge de la piste (en % de la largeur). */
const MIN_GAP = 3
const EDGE = 4

/**
 * Positions des points d'une ligne (0–100), triés par date : gardés dans la piste et écartés s'ils se chevauchent, pour
 * que deux commits proches restent cliquables. Pur.
 */
export function spread<T>(items: readonly T[], position: (item: T) => number): { item: T; left: number }[] {
  const lefts = items.map((item) => EDGE + (Math.min(100, Math.max(0, position(item))) / 100) * (100 - 2 * EDGE))
  for (let index = 1; index < lefts.length; index += 1) {
    lefts[index] = Math.max(lefts[index] ?? 0, (lefts[index - 1] ?? 0) + MIN_GAP)
  }
  for (let index = lefts.length - 1; index >= 0; index -= 1) {
    const limit = index === lefts.length - 1 ? 100 - EDGE : (lefts[index + 1] ?? 0) - MIN_GAP
    lefts[index] = Math.max(EDGE, Math.min(lefts[index] ?? 0, limit))
  }
  return items.map((item, index) => ({ item, left: lefts[index] ?? EDGE }))
}

/** Pages chargées réunies (auteurs dédoublonnés). */
function combine(first: HistoryView, extra: readonly HistoryView[]): HistoryView {
  return extra.reduce<HistoryView>(
    (all, page) => ({
      commits: [...all.commits, ...page.commits],
      authors: [
        ...all.authors,
        ...page.authors.filter((author) => !all.authors.some((known) => known.key === author.key))
      ],
      merged: page.merged,
      more: page.more
    }),
    first
  )
}

/** Commits de la fenêtre de temps (la plus récente date en fin de frise). */
export function windowOf(
  commits: readonly GitCommitView[],
  zoom: Zoom
): { readonly start: number; readonly end: number; readonly shown: readonly GitCommitView[] } {
  const times = commits.map((commit) => Date.parse(commit.date))
  const end = Math.max(...times, 0)
  const limit = end - SPANS[zoom] * DAY
  // Historique plus court que le zoom : la frise commence au premier commit affiché (rien n'est tassé à droite).
  const start = Math.max(limit, Math.min(...times, end))
  return { start, end, shown: commits.filter((commit) => Date.parse(commit.date) >= limit) }
}

/**
 * Frise « qui a fait quoi et quand » (spec 021 US5, lot 1) : une ligne par auteur (couleur ET initiales, légende
 * toujours visible), un point par commit, zoom semaine / mois / année, flèches ← → = commit précédent / suivant,
 * « Charger plus », fusion de deux identités d'une même personne, « Raconter la période » par Claude (pseudonymes,
 * vrais noms remis ici).
 */
export function Timeline({
  genesisId,
  readOnly
}: {
  readonly genesisId: string
  readonly readOnly: boolean
}): React.JSX.Element | null {
  const client = useQueryClient()
  const [zoom, setZoom] = useState<Zoom>('mois')
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<readonly string[]>([])
  const points = useRef(new Map<string, HTMLButtonElement>())
  // Première page : relue d'elle-même quand le dépôt change (`git:changed`) ; « Charger plus » ajoute des pages.
  const first = useQuery({
    queryKey: [...gitKeys.all(genesisId), 'history'],
    queryFn: () => call<HistoryView>('git:history', { genesisId, skip: 0, limit: PAGE })
  })
  const [extra, setExtra] = useState<readonly HistoryView[]>([])
  useEffect(() => setExtra([]), [first.data])
  const load = useMutation({
    mutationFn: (skip: number) => call<HistoryView>('git:history', { genesisId, skip, limit: PAGE }),
    onSuccess: (page) => setExtra((list) => [...list, page])
  })
  const pages = useMemo(() => (first.data === undefined ? null : combine(first.data, extra)), [first.data, extra])
  const reload = (): void => void client.invalidateQueries({ queryKey: [...gitKeys.all(genesisId), 'history'] })

  const mergeAuthors = useMutation({
    mutationFn: (keys: readonly string[]) =>
      call('git:mergeAuthors', { genesisId, mainKey: keys[0], aliasKeys: keys.slice(1) }),
    onSuccess: () => {
      setChecked([])
      reload()
      void client.invalidateQueries({ queryKey: gitKeys.log(genesisId) })
    }
  })
  const unmerge = useMutation({
    mutationFn: (aliasKey: string) => call('git:unmergeAuthor', { genesisId, aliasKey }),
    onSuccess: reload
  })
  const story = useMutation({
    mutationFn: (range: { readonly from: string; readonly to: string }) =>
      call<StoryView>('git:story', { genesisId, ...range })
  })

  const view = useMemo(() => (pages === null ? null : windowOf(pages.commits, zoom)), [pages, zoom])
  if (pages === null || view === null) return null
  if (pages.commits.length === 0) return null
  const authors = new Map(pages.authors.map((author) => [author.key, author] as const))
  // Du plus ancien au plus récent : ← = commit précédent, → = suivant.
  const ordered = [...view.shown].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const span = Math.max(1, view.end - view.start)
  const current = pages.commits.find((commit) => commit.hash === selected) ?? null
  const move = (from: string, step: number): void => {
    const index = ordered.findIndex((commit) => commit.hash === from)
    const next = ordered[index + step]
    if (next === undefined) return
    setSelected(next.hash)
    points.current.get(next.hash)?.focus()
  }
  const error = [load, mergeAuthors, unmerge, story].find((mutation) => mutation.error !== null)?.error ?? null

  return (
    <section
      aria-label="Frise des auteurs"
      className="flex flex-col gap-2 rounded-md border border-content-muted/20 p-2"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <p className="flex-1 font-semibold">Qui a fait quoi et quand</p>
        <div role="group" aria-label="Zoom de la frise" className="flex gap-1">
          {(['semaine', 'mois', 'annee'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={zoom === value}
              onClick={() => setZoom(value)}
              className={`rounded px-2 py-1 ${zoom === value ? 'bg-accent/15 font-semibold' : 'hover:bg-surface-raised'}`}
            >
              {value === 'annee' ? 'année' : value}
            </button>
          ))}
        </div>
      </div>

      <ul aria-label="Légende des auteurs" className="flex flex-wrap gap-2 text-xs">
        {pages.authors.map((author) => (
          <li key={author.key} className="flex items-center gap-1">
            <input
              type="checkbox"
              aria-label={`Choisir ${author.name} pour fusionner`}
              checked={checked.includes(author.key)}
              disabled={readOnly}
              onChange={() =>
                setChecked((list) =>
                  list.includes(author.key) ? list.filter((key) => key !== author.key) : [...list, author.key]
                )
              }
            />
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: author.color }}
            >
              {author.initials}
            </span>
            {author.name}
          </li>
        ))}
      </ul>
      {checked.length >= 2 ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="flex-1">
            Même personne ? « {authors.get(checked[0] ?? '')?.name} » gardera ses commits et ceux des autres cochés.
          </span>
          <Button disabled={mergeAuthors.isPending} onClick={() => mergeAuthors.mutate(checked)}>
            Fusionner les identités
          </Button>
        </div>
      ) : null}
      {pages.merged.length === 0 ? null : (
        <ul aria-label="Identités fusionnées" className="flex flex-col gap-1 text-xs text-content-muted">
          {pages.merged.map((alias) => (
            <li key={alias.key} className="flex items-center gap-2">
              {alias.name} → {authors.get(alias.mainKey)?.name ?? 'autre identité'}
              <button
                type="button"
                className="underline"
                disabled={unmerge.isPending || readOnly}
                onClick={() => unmerge.mutate(alias.key)}
              >
                Séparer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1">
        {pages.authors.map((author) => (
          <div key={author.key} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-center text-[10px] font-semibold" title={author.name}>
              {author.initials}
            </span>
            <div className="relative h-5 flex-1 rounded bg-surface-raised">
              {spread(
                ordered.filter((commit) => commit.authorKey === author.key),
                (commit) => (view.end === view.start ? 50 : ((Date.parse(commit.date) - view.start) / span) * 100)
              ).map(({ item: commit, left }) => (
                <button
                  key={commit.hash}
                  ref={(element) => {
                    if (element === null) points.current.delete(commit.hash)
                    else points.current.set(commit.hash, element)
                  }}
                  type="button"
                  aria-label={`${commit.subject}, ${dateText(commit.date)}, ${author.name}`}
                  aria-pressed={selected === commit.hash}
                  onClick={() => setSelected(commit.hash)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                      event.preventDefault()
                      move(commit.hash, event.key === 'ArrowLeft' ? -1 : 1)
                    }
                  }}
                  className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                    selected === commit.hash ? 'border-content' : 'border-surface'
                  }`}
                  style={{
                    left: `${left}%`,
                    background: author.color
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-content-muted">
        {view.shown.length} commit(s) du {dateText(new Date(view.start).toISOString())} au{' '}
        {dateText(new Date(view.end).toISOString())}
        {current === null ? '' : ` · sélection : « ${current.subject} » (${dateText(current.date)})`}
      </p>
      <div className="flex flex-wrap gap-2">
        {pages.more ? (
          <Button disabled={load.isPending} onClick={() => load.mutate(pages.commits.length)}>
            Charger plus
          </Button>
        ) : null}
        <Button
          disabled={story.isPending || ordered.length === 0}
          onClick={() => story.mutate({ from: ordered[0]?.hash ?? '', to: ordered.at(-1)?.hash ?? '' })}
        >
          {story.isPending ? 'Claude raconte…' : '✨ Raconter la période'}
        </Button>
      </div>
      {story.data === undefined ? null : (
        <div role="status" className="rounded-md bg-surface-raised p-2 text-xs whitespace-pre-wrap">
          {withRealNames(story.data, pages.authors)}
        </div>
      )}
      {error === null ? null : (
        <p role="alert" className="text-xs text-con">
          {errorText(error)}
        </p>
      )}
    </section>
  )
}
