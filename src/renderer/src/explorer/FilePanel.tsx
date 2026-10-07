import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CodeBlockLinkView,
  CodeBlockView,
  CodeCategory,
  ExplorerPlaceView,
  FileCodeView
} from '@shared/ipc/reprise'
import { CODE_CATEGORIES } from '@shared/ipc/reprise'
import { CodeLines } from '../lib/CodeLines'
import { call, IpcFailure } from '../lib/ipc'
import { CATEGORY_LABELS, KIND_LABELS, PROVENANCE_LABELS } from './labels'

/** Fichier ouvert dans le volet : son chemin, et la ligne ou le bloc où se placer. */
export interface OpenFile {
  readonly path: string
  readonly line: number | null
  readonly symbolId: string | null
}

const VERBS: Readonly<Record<CodeBlockLinkView['kind'], string>> = {
  call: 'appelle',
  import: 'importe',
  implements: 'implémente',
  route: 'route vers',
  injects: 'reçoit'
}

/** Nom court d'un lien (`Shop.Domain.OrderService.Place` → `OrderService.Place`), le nom complet au survol. */
const shortName = (title: string): string =>
  title
    .split(/[.\\/]/)
    .slice(-2)
    .join('.')

function LinkChips({
  label,
  links,
  onGo
}: {
  readonly label: string
  readonly links: readonly CodeBlockLinkView[]
  readonly onGo: (link: CodeBlockLinkView) => void
}): React.JSX.Element | null {
  if (links.length === 0) return null
  return (
    <p className="flex flex-wrap items-baseline gap-1">
      <span className="text-content-muted">{label}</span>
      {links.map((link, index) => (
        <button
          key={`${link.symbolId}-${index}`}
          type="button"
          title={`${link.title} — ${link.path}, ${PROVENANCE_LABELS[link.provenance].text}`}
          aria-label={`${link.title} (${link.path}), ${PROVENANCE_LABELS[link.provenance].text} : ouvrir`}
          onClick={() => onGo(link)}
          className="rounded border border-content-muted/40 px-1.5 text-left underline-offset-2 hover:underline"
        >
          {shortName(link.title)}
          {link.count > 1 ? ` ×${link.count}` : ''}{' '}
          <span aria-hidden="true" className="text-content-muted">
            {PROVENANCE_LABELS[link.provenance].mark}
          </span>
        </button>
      ))}
    </p>
  )
}

/**
 * Volet de code de l'explorateur (spec 017 D16, FR-037) : le fichier entier en lecture seule ; avant chaque bloc,
 * qui l'appelle et ce qu'il appelle (fiabilité comprise), et sa catégorie, corrigeable (FR-018) ; les lignes d'appel
 * repérées sont marquées. Un clic sur un lien ouvre l'autre fichier au bon bloc, dans ce même volet.
 */
export function FilePanel({
  genesisId,
  file,
  onOpenFile,
  onPlaced
}: {
  readonly genesisId: string
  readonly file: OpenFile
  readonly onOpenFile: (file: OpenFile) => void
  /** Le fichier lu : la carte peut montrer son dossier. */
  readonly onPlaced: (place: ExplorerPlaceView) => void
}): React.JSX.Element {
  const client = useQueryClient()
  const [problem, setProblem] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['explorer', genesisId, 'file', file.path],
    queryFn: () => call<FileCodeView>('explorer:file', { genesisId, path: file.path })
  })
  const view = query.data

  // Une fois par fichier lu (pas à chaque relecture après une correction).
  const placed = useRef(onPlaced)
  placed.current = onPlaced
  const place = view?.place
  const placedPath = view?.path
  useEffect(() => {
    if (place !== undefined) placed.current(place)
  }, [placedPath]) // `place` change à chaque relecture : seul le chemin compte.

  const target = useMemo(() => {
    if (view === undefined) return null
    const line = file.line ?? view.blocks.find((block) => block.symbolId === file.symbolId)?.startLine ?? null
    return line === null ? null : { from: line, to: line }
  }, [view, file.line, file.symbolId])
  const headers = useMemo(() => {
    const byLine = new Map<number, CodeBlockView[]>()
    for (const block of view?.blocks ?? []) byLine.set(block.startLine, [...(byLine.get(block.startLine) ?? []), block])
    return byLine
  }, [view])
  const flagged = useMemo(
    () =>
      new Set(
        (view?.blocks ?? []).flatMap((block) =>
          block.callees.map((link) => link.at).filter((line): line is number => line !== null)
        )
      ),
    [view]
  )

  const correct = async (symbolId: string, category: CodeCategory): Promise<void> => {
    setProblem(null)
    try {
      await call('reprise:setCategory', { genesisId, symbolId, category })
      await client.invalidateQueries({ queryKey: ['explorer', genesisId] })
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'La catégorie n’a pas pu être changée.')
    }
  }
  const go = (link: CodeBlockLinkView): void =>
    onOpenFile({ path: link.path, line: link.line, symbolId: link.symbolId })

  if (view === undefined) {
    return (
      <p role={query.isError ? 'alert' : undefined} className="p-4 text-sm text-content-muted">
        {query.error instanceof IpcFailure
          ? query.error.message
          : query.isError
            ? 'Le fichier n’a pas pu être lu.'
            : 'Lecture du fichier…'}
      </p>
    )
  }
  return (
    <section aria-label={`Code de ${view.path}`} className="flex h-full min-h-0 flex-col gap-2 p-3 text-xs">
      <header>
        <h2 className="truncate text-sm font-semibold" title={view.path}>
          {view.path.split('/').at(-1)}
        </h2>
        <p className="truncate text-content-muted">
          {view.path} · {view.lang} · {view.lines.length} lignes · lecture seule · ◀ appel repéré (approché)
        </p>
        {view.error === null ? null : <p role="alert">Non analysé : {view.error}</p>}
        {view.truncated ? <p>Fichier long : seules les {view.lines.length} premières lignes sont montrées.</p> : null}
        {problem === null ? null : (
          <p role="alert" className="text-con">
            {problem}
          </p>
        )}
      </header>
      <CodeLines
        lines={view.lines}
        lang={view.lang}
        marked={target}
        flagged={flagged}
        before={(line) =>
          headers.get(line)?.map((block) => (
            <div
              key={block.symbolId}
              role="group"
              aria-label={`${KIND_LABELS[block.kind].text} ${block.name}`}
              className="my-1 ml-12 mr-2 flex flex-col gap-1 rounded-md border-l-2 border-accent bg-surface px-2 py-1 font-sans whitespace-normal"
            >
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  <span aria-hidden="true">{KIND_LABELS[block.kind].icon}</span> {block.name}
                </span>
                {block.kind === 'file' ? null : (
                  <select
                    aria-label={`Catégorie de ${block.name}${block.corrected ? ' (corrigée par toi)' : ''}`}
                    value={block.category}
                    onChange={(event) => void correct(block.symbolId, event.target.value as CodeCategory)}
                    className="h-6 rounded bg-surface-raised px-1"
                  >
                    {CODE_CATEGORIES.map((value) => (
                      <option key={value} value={value}>
                        {CATEGORY_LABELS[value].icon} {CATEGORY_LABELS[value].text}
                      </option>
                    ))}
                  </select>
                )}
              </p>
              <LinkChips label="← appelé par :" links={block.callers} onGo={go} />
              {[...new Set(block.callees.map((link) => link.kind))].map((kind) => (
                <LinkChips
                  key={kind}
                  label={`→ ${VERBS[kind]} :`}
                  links={block.callees.filter((link) => link.kind === kind)}
                  onGo={go}
                />
              ))}
              {block.external === 0 ? null : (
                <p className="text-content-muted">
                  + {block.external} appel{block.external > 1 ? 's' : ''} hors du projet (bibliothèques)
                </p>
              )}
            </div>
          )) ?? null
        }
      />
    </section>
  )
}
