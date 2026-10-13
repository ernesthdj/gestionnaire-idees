import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryView, StoryView } from '@shared/git/history'
import type { AuthorView, GitCommitView } from '@shared/git/model'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { gitKeys } from './gitQueries'
import { ContributionSkyline, type SkylineSpan } from './skyline/ContributionSkyline'

type Zoom = 'semaine' | 'mois' | 'annee'
const SPANS: Readonly<Record<Zoom, number>> = { semaine: 7, mois: 31, annee: 366 }
const DAY = 24 * 60 * 60 * 1000
/** La Skyline suit le zoom de la frise. */
const SKYLINE_SPANS: Readonly<Record<Zoom, SkylineSpan>> = {
  semaine: { days: 7, label: 'sur une semaine' },
  mois: { days: 31, label: 'sur un mois' },
  annee: { days: 365, label: 'sur un an' }
}
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
const MIN_GAP = 1.5
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

/**
 * Commits de la fenêtre de temps : la plus récente date en fin de frise, ou la fenêtre centrée sur `centre` (un jour
 * choisi dans la Skyline, en millisecondes).
 */
export function windowOf(
  commits: readonly GitCommitView[],
  zoom: Zoom,
  centre?: number
): { readonly start: number; readonly end: number; readonly shown: readonly GitCommitView[] } {
  if (centre !== undefined) {
    const half = (SPANS[zoom] * DAY) / 2
    const [start, end] = [centre - half, centre + half]
    return {
      start,
      end,
      shown: commits.filter((commit) => Date.parse(commit.date) >= start && Date.parse(commit.date) <= end)
    }
  }
  const times = commits.map((commit) => Date.parse(commit.date))
  const end = Math.max(...times, 0)
  // Toujours toute la période du zoom : semaine, mois et année se distinguent même sur un historique court.
  const start = end - SPANS[zoom] * DAY
  return { start, end, shown: commits.filter((commit) => Date.parse(commit.date) >= start) }
}

/** Tranche de temps regroupée en un seul point : 6 h à la semaine, un jour au mois, une semaine à l'année. */
const BUCKETS: Readonly<Record<Zoom, number>> = { semaine: DAY / 4, mois: DAY, annee: 7 * DAY }

export interface CommitBucket {
  readonly key: string
  readonly authorKey: string
  /** Du plus ancien au plus récent. */
  readonly commits: readonly GitCommitView[]
  /** Milieu de la tranche (ms). */
  readonly at: number
}

/**
 * Points de la frise : les commits d'un même auteur dans une même tranche sont regroupés (un point, leur nombre), sinon
 * des centaines de commits s'empileraient au bord de la piste et les zooms se ressembleraient. Triés par date. Pur.
 */
export function bucketsOf(commits: readonly GitCommitView[], zoom: Zoom): CommitBucket[] {
  const groups = new Map<string, { slot: number; list: GitCommitView[] }>()
  for (const commit of [...commits].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    const slot = sliceStart(Date.parse(commit.date), zoom)
    const key = `${commit.authorKey}:${slot}`
    const group = groups.get(key) ?? { slot, list: [] }
    group.list.push(commit)
    groups.set(key, group)
  }
  return [...groups]
    .map(([key, { slot, list }]) => ({
      key,
      authorKey: list[0]?.authorKey ?? '',
      commits: list,
      at: slot + BUCKETS[zoom] / 2
    }))
    .sort((a, b) => a.at - b.at || a.authorKey.localeCompare(b.authorKey))
}

/** Début de la tranche d'un instant, sur le calendrier local : minuit (+ 6 h par 6 h à la semaine), lundi à l'année. */
function sliceStart(time: number, zoom: Zoom): number {
  const date = new Date(time)
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (zoom === 'semaine') return midnight.getTime() + Math.floor(date.getHours() / 6) * (DAY / 4)
  if (zoom === 'mois') return midnight.getTime()
  midnight.setDate(midnight.getDate() - ((midnight.getDay() + 6) % 7))
  return midnight.getTime()
}

/**
 * Frise « qui a fait quoi et quand » (spec 021 US5, lot 1) : une ligne par auteur (couleur ET initiales, légende
 * toujours visible), un point par tranche de temps (son nombre de commits), zoom semaine / mois / année, flèches ← → =
 * point précédent / suivant,
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
  // Skyline (D16) : auteur affiché (`null` : tous) et jour choisi, sur lequel la frise se centre.
  const [focus, setFocus] = useState<string | null>(null)
  const [centre, setCentre] = useState<number | undefined>(undefined)
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

  const view = useMemo(() => (pages === null ? null : windowOf(pages.commits, zoom, centre)), [pages, zoom, centre])
  const skylineDates = useMemo(
    () =>
      (pages?.commits ?? [])
        .filter((commit) => focus === null || commit.authorKey === focus)
        .map((commit) => commit.date),
    [pages, focus]
  )
  if (pages === null || view === null) return null
  if (pages.commits.length === 0) return null
  const authors = new Map(pages.authors.map((author) => [author.key, author] as const))
  // Points du plus ancien au plus récent : ← = point précédent, → = suivant.
  const ordered = bucketsOf(view.shown, zoom)
  const span = Math.max(1, view.end - view.start)
  const lastOf = (bucket: CommitBucket): string => bucket.commits.at(-1)?.hash ?? ''
  const current = pages.commits.find((commit) => commit.hash === selected) ?? null
  const focused = focus === null ? undefined : authors.get(focus)
  // Un jour de la Skyline (« AAAA-MM-JJ ») : frise d'une semaine centrée sur midi de ce jour, premier commit choisi.
  const showDay = (date: string): void => {
    const [year, month, day] = date.split('-').map(Number)
    const noon = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12).getTime()
    setZoom('semaine')
    setCentre(noon)
    const first = pages.commits
      .filter((commit) => focus === null || commit.authorKey === focus)
      .find((commit) => Math.abs(Date.parse(commit.date) - noon) <= DAY / 2)
    setSelected(first?.hash ?? null)
  }
  const move = (from: string, step: number): void => {
    const index = ordered.findIndex((bucket) => bucket.key === from)
    const next = ordered[index + step]
    if (next === undefined) return
    setSelected(lastOf(next))
    points.current.get(next.key)?.focus()
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

      <ContributionSkyline
        dates={skylineDates}
        color={focused?.color ?? null}
        title={focused?.name ?? 'Tous les auteurs'}
        span={SKYLINE_SPANS[zoom]}
        onDayClick={showDay}
      />

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
            <button
              type="button"
              aria-pressed={focus === author.key}
              aria-label={`Skyline de ${author.name}`}
              className={`rounded px-1 ${focus === author.key ? 'bg-accent/15 font-semibold' : 'hover:bg-surface-raised'}`}
              onClick={() => setFocus((key) => (key === author.key ? null : author.key))}
            >
              {author.name}
            </button>
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
                ordered.filter((bucket) => bucket.authorKey === author.key),
                (bucket) => ((bucket.at - view.start) / span) * 100
              ).map(({ item: bucket, left }) => {
                const count = bucket.commits.length
                const only = bucket.commits[0]
                const pressed = bucket.commits.some((commit) => commit.hash === selected)
                return (
                  <button
                    key={bucket.key}
                    ref={(element) => {
                      if (element === null) points.current.delete(bucket.key)
                      else points.current.set(bucket.key, element)
                    }}
                    type="button"
                    aria-label={
                      count === 1 && only !== undefined
                        ? `${only.subject}, ${dateText(only.date)}, ${author.name}`
                        : `${count} commits du ${dateText(bucket.commits[0]?.date ?? '')} au ${dateText(bucket.commits.at(-1)?.date ?? '')}, ${author.name}`
                    }
                    aria-pressed={pressed}
                    onClick={() => setSelected(lastOf(bucket))}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                        event.preventDefault()
                        move(bucket.key, event.key === 'ArrowLeft' ? -1 : 1)
                      }
                    }}
                    className={`absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[9px] font-semibold text-white ${
                      count === 1 ? 'h-3 w-3' : count < 10 ? 'h-4 w-4' : 'h-5 min-w-5 px-0.5'
                    } ${pressed ? 'border-content' : 'border-surface'}`}
                    style={{ left: `${left}%`, background: author.color }}
                  >
                    {count === 1 ? null : count}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-content-muted">
        {view.shown.length} commit(s) du {dateText(new Date(view.start).toISOString())} au{' '}
        {dateText(new Date(view.end).toISOString())}
        {current === null ? '' : ` · sélection : « ${current.subject} » (${dateText(current.date)})`}
        {centre === undefined ? null : (
          <>
            {' · '}
            <button type="button" className="underline" onClick={() => setCentre(undefined)}>
              Revenir au plus récent
            </button>
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {pages.more ? (
          <Button disabled={load.isPending} onClick={() => load.mutate(pages.commits.length)}>
            Charger plus
          </Button>
        ) : null}
        <Button
          disabled={story.isPending || ordered.length === 0}
          onClick={() =>
            story.mutate({
              from: ordered[0]?.commits[0]?.hash ?? '',
              to: lastOf(ordered.at(-1) ?? { key: '', authorKey: '', commits: [], at: 0 })
            })
          }
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
