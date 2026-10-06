import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import type { DeliverableFileDetailView } from '@shared/ipc/finals'
import { lineDiff } from '@shared/diff/lineDiff'
import { useUiStore } from '../app/uiStore'
import { highlight, splitHighlightLines, type HighlightNode } from '../lib/highlight'
import { Highlighted } from '../lib/Highlighted'
import { call, IpcFailure } from '../lib/ipc'

export const viewerKey = (neuronId: string, path: string): readonly string[] => ['deliverable', neuronId, 'file', path]

type Tab = 'diff' | 'file'

/** Première ligne changée dans le contenu de référence (actuel, sinon écrit par Claude) : l'éditeur s'y ouvre. */
export function firstChangedLine(file: DeliverableFileDetailView): number {
  const diff = lineDiff(file.before, file.current ?? file.after)
  if (diff.kind === 'summary') return 1
  let line = 1
  for (const entry of diff.lines) {
    if (entry.kind !== 'same') return line
    line++
  }
  return 1
}

/**
 * Visionneuse en lecture seule d'un fichier du livrable (spec 013 D4) : la différence depuis l'état d'avant
 * l'exécution, et le contenu actuel coloré avec ses numéros de ligne. Rien n'est éditable ici.
 */
export function FileViewer({
  neuronId,
  path,
  onClose
}: {
  readonly neuronId: string
  readonly path: string
  readonly onClose: () => void
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('diff')
  const titleId = useId()
  const query = useQuery({
    queryKey: viewerKey(neuronId, path),
    queryFn: () => call<DeliverableFileDetailView>('deliverable:file', { neuronId, path })
  })
  const file = query.data
  const showToast = useUiStore((state) => state.showToast)
  const [opening, setOpening] = useState(false)
  const openInEditor = async (current: DeliverableFileDetailView): Promise<void> => {
    setOpening(true)
    try {
      await call('deliverable:openInEditor', { neuronId, path, line: firstChangedLine(current) })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'Le fichier n’a pas pu être ouvert.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <section aria-labelledby={titleId} className="flex h-full flex-col text-sm">
      <header className="flex items-start gap-2 border-b border-content-muted/20 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-content-muted">Fichier du livrable · lecture seule</p>
          <h2 id={titleId} className="truncate font-mono text-sm font-semibold" title={path}>
            {path}
          </h2>
          {file?.changedSince === true ? (
            <p className="mt-1 text-xs font-semibold text-idea">Modifié depuis l’écriture de Claude</p>
          ) : null}
          {file === undefined || file.missing ? null : (
            <button
              type="button"
              disabled={opening}
              onClick={() => void openInEditor(file)}
              className="mt-2 h-8 rounded-md border border-content-muted/40 px-3 text-xs disabled:opacity-50"
            >
              Ouvrir dans l’éditeur
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la visionneuse"
          className="h-8 w-8 shrink-0 rounded-md hover:bg-surface-raised"
        >
          ×
        </button>
      </header>
      {query.isError ? (
        <p role="alert" className="p-4 text-con">
          {query.error instanceof IpcFailure ? query.error.message : 'Le fichier n’a pas pu être lu.'}
        </p>
      ) : file === undefined ? (
        <p className="p-4 text-content-muted">Lecture du fichier…</p>
      ) : (
        <>
          <div role="tablist" aria-label="Affichage" className="flex gap-1 border-b border-content-muted/20 px-4">
            <TabButton id="diff" current={tab} onSelect={setTab}>
              Différences
            </TabButton>
            <TabButton id="file" current={tab} onSelect={setTab}>
              Fichier
            </TabButton>
          </div>
          <div
            role="tabpanel"
            aria-label={tab === 'diff' ? 'Différences' : 'Fichier'}
            className="min-h-0 flex-1 overflow-auto"
            tabIndex={0}
          >
            {tab === 'diff' ? <DiffView file={file} /> : <SourceView file={file} />}
          </div>
        </>
      )}
    </section>
  )
}

function TabButton({
  id,
  current,
  onSelect,
  children
}: {
  readonly id: Tab
  readonly current: Tab
  readonly onSelect: (tab: Tab) => void
  readonly children: string
}): React.JSX.Element {
  const selected = id === current
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(id)}
      className={`-mb-px h-9 border-b-2 px-3 ${selected ? 'border-action font-semibold' : 'border-transparent text-content-muted'}`}
    >
      {children}
    </button>
  )
}

/** Raison pour laquelle le contenu actuel ne peut pas être affiché ; `null` s'il est lisible. */
function unreadable(file: DeliverableFileDetailView): string | null {
  if (file.missing) return 'Le fichier n’existe plus dans le projet (ou le dossier lié est introuvable).'
  if (file.tooBig) return 'Fichier trop volumineux pour la visionneuse (plus de 1 Mo).'
  if (file.binary) return 'Ce fichier n’est pas un fichier texte.'
  return null
}

function DiffView({ file }: { readonly file: DeliverableFileDetailView }): React.JSX.Element {
  // Contenu de référence : l'actuel s'il est lisible (il reflète les retouches), sinon le dernier écrit par Claude.
  const reference = file.current ?? file.after
  const diff = useMemo(() => lineDiff(file.before, reference), [file.before, reference])
  // Coloration du texte entier (avant / référence) puis découpe en lignes : une ligne retirée prend celle d'avant.
  const colored = useMemo(() => {
    const lines = (text: string | null): HighlightNode[][] | null => {
      const tree = text === null ? null : highlight(text, file.language)
      return tree === null ? null : splitHighlightLines(tree)
    }
    return { before: lines(file.before), after: lines(reference) }
  }, [file.before, reference, file.language])
  const rows = useMemo(() => {
    if (diff.kind === 'summary') return []
    let a = 0
    let b = 0
    return diff.lines.map((line) => {
      const tokens = line.kind === 'removed' ? colored.before?.[a] : colored.after?.[b]
      if (line.kind !== 'added') a++
      if (line.kind !== 'removed') b++
      return { ...line, tokens }
    })
  }, [diff, colored])
  const note = unreadable(file)
  return (
    <div className="flex flex-col">
      {note === null ? null : (
        <p className="px-4 pt-3 text-xs text-content-muted">
          {note} Différence avec le dernier contenu écrit par Claude.
        </p>
      )}
      {diff.kind === 'summary' ? (
        <p className="p-4 text-content-muted">
          Différence trop grande pour être détaillée : {diff.beforeLines} lignes avant, {diff.afterLines} lignes après.
        </p>
      ) : diff.lines.length === 0 ? (
        <p className="p-4 text-content-muted">Aucune différence.</p>
      ) : (
        <>
          <p className="px-4 pt-3 text-xs text-content-muted">
            <span className="text-pro">+{diff.added}</span> · <span className="text-con">−{diff.removed}</span>
            {file.before === null ? ' · fichier créé' : ''}
          </p>
          <pre className="viewer-code hljs py-2 font-mono text-xs">
            {rows.map((line, index) => (
              <div key={index} className={`viewer-diff-${line.kind} px-4`}>
                <span aria-hidden="true" className="inline-block w-4 select-none">
                  {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}
                </span>
                <span className="sr-only">
                  {line.kind === 'added' ? 'ajoutée : ' : line.kind === 'removed' ? 'retirée : ' : ''}
                </span>
                {line.text === '' ? ' ' : line.tokens === undefined ? line.text : <Highlighted nodes={line.tokens} />}
              </div>
            ))}
          </pre>
        </>
      )}
    </div>
  )
}

function SourceView({ file }: { readonly file: DeliverableFileDetailView }): React.JSX.Element {
  const note = unreadable(file)
  const text = file.current ?? ''
  const tree = useMemo(() => (note === null ? highlight(text, file.language) : null), [note, text, file.language])
  if (note !== null) return <p className="p-4 text-content-muted">{note}</p>
  const count = text === '' ? 1 : text.replace(/\r\n/g, '\n').split('\n').length
  return (
    <div className="viewer-code flex py-2 font-mono text-xs">
      <pre aria-hidden="true" className="shrink-0 px-3 text-right text-content-muted select-none">
        {Array.from({ length: count }, (_, index) => index + 1).join('\n')}
      </pre>
      <pre className="min-w-0 flex-1 pr-4">
        <code className="hljs">{tree === null ? text : <Highlighted nodes={tree} />}</code>
      </pre>
    </div>
  )
}
