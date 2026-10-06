import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { ElementFilesView, ElementFileView } from '@shared/ipc/reprise'
import { KIND_LABELS } from '../explorer/labels'
import { CodeLines } from '../lib/CodeLines'
import { call, IpcFailure } from '../lib/ipc'

const errorText = (error: unknown, fallback: string): string => (error instanceof IpcFailure ? error.message : fallback)

/**
 * Fichiers d'un élément de la carte de structure (spec 017 US7, FR-032) : ses chemins développés en fichiers du
 * projet lié ; un clic ouvre le fichier en lecture seule.
 */
export function ElementFiles({
  elementId,
  onOpen
}: {
  readonly elementId: string
  readonly onOpen: (path: string) => void
}): React.JSX.Element | null {
  const query = useQuery({
    queryKey: ['structure', elementId, 'files'],
    queryFn: () => call<ElementFilesView>('structure:files', { elementId })
  })
  const view = query.data
  if (query.error !== null) {
    return (
      <p role="alert" className="text-xs text-content-muted">
        {errorText(query.error, 'Les fichiers de cet élément n’ont pas pu être listés.')}
      </p>
    )
  }
  if (view === undefined) return null
  if (view.files.length === 0) {
    return (
      <p className="text-xs text-content-muted">
        {view.paths.length === 0
          ? 'Aucun fichier associé à cet élément sur la carte.'
          : `Aucun fichier trouvé pour : ${view.paths.join(', ')}.`}
      </p>
    )
  }
  return (
    <details open className="rounded-md border border-content-muted/20 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold">
        Fichiers ({view.files.length}
        {view.truncated ? '+' : ''})
      </summary>
      <ul className="mt-2 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {view.files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => onOpen(file.path)}
              className="w-full truncate rounded px-1 text-left font-mono text-xs hover:bg-surface-raised"
              title={file.path}
            >
              {file.path}
              {file.lines === null ? '' : <span className="text-content-muted"> · {file.lines} l.</span>}
            </button>
          </li>
        ))}
      </ul>
      {view.truncated ? (
        <p className="mt-1 text-xs text-content-muted">Liste limitée aux 200 premiers fichiers.</p>
      ) : null}
    </details>
  )
}

/**
 * Lecteur d'un fichier d'élément, en lecture seule (spec 017 US7) : le code coloré et numéroté ; pour un projet
 * analysé, ses symboles et le nombre de leurs appelants, un clic place la vue sur le symbole.
 */
export function ElementFileReader({
  elementId,
  path,
  onBack
}: {
  readonly elementId: string
  readonly path: string
  readonly onBack: () => void
}): React.JSX.Element {
  const titleId = useId()
  const [marked, setMarked] = useState<{ readonly from: number; readonly to: number } | null>(null)
  const query = useQuery({
    queryKey: ['structure', elementId, 'file', path],
    queryFn: () => call<ElementFileView>('structure:file', { elementId, path })
  })
  const file = query.data
  return (
    <section aria-labelledby={titleId} className="flex h-full flex-col gap-2 p-4 text-sm">
      <header className="flex items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-8 shrink-0 rounded-md border border-content-muted/40 px-2 text-xs hover:bg-surface-raised"
        >
          ← Conversation
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-content-muted">Fichier de l’élément · lecture seule</p>
          <h3 id={titleId} className="truncate font-mono text-sm font-semibold" title={path}>
            {path}
          </h3>
        </div>
      </header>
      {query.error !== null ? (
        <p role="alert" className="text-con">
          {errorText(query.error, 'Le fichier n’a pas pu être lu.')}
        </p>
      ) : file === undefined ? (
        <p className="text-content-muted">Lecture du fichier…</p>
      ) : (
        <>
          {file.symbols.length === 0 ? null : (
            <nav aria-label="Symboles du fichier" className="max-h-36 shrink-0 overflow-y-auto">
              <ul className="flex flex-col gap-0.5">
                {file.symbols.map((symbol) => (
                  <li key={symbol.id}>
                    <button
                      type="button"
                      onClick={() => setMarked({ from: symbol.startLine, to: symbol.endLine })}
                      className="w-full truncate rounded px-1 text-left text-xs hover:bg-surface-raised"
                    >
                      <span aria-hidden="true">{KIND_LABELS[symbol.kind].icon} </span>
                      <span className="font-mono">{symbol.name}</span>
                      <span className="text-content-muted">
                        {' '}
                        · {KIND_LABELS[symbol.kind].text} · ligne {symbol.startLine} ·{' '}
                        {symbol.callers === 0
                          ? 'aucun appel venu d’ailleurs'
                          : `appelé ${symbol.callers} fois d’ailleurs`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <CodeLines lines={file.lines} lang={file.lang} marked={marked} />
        </>
      )}
    </section>
  )
}
