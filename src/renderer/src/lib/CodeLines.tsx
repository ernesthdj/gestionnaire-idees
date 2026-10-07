import { Fragment, useEffect, useMemo, useRef } from 'react'
import type { CodeLang } from '@shared/ipc/reprise'
import { highlight, splitHighlightLines } from './highlight'
import { Highlighted } from './Highlighted'

const LANGUAGES: Readonly<Record<CodeLang, string | null>> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  cs: 'csharp',
  php: 'php',
  other: null
}

/**
 * Lignes de code en lecture seule (spec 017 FR-025, US7) : colorées sans jamais interpréter de HTML, numérotées à
 * partir de `startLine` ; une plage peut être mise en avant, et la vue se place sur sa première ligne. `before` insère
 * une annotation avant une ligne (en-tête d'un bloc, D16) ; `flagged` marque des lignes (appels repérés).
 */
export function CodeLines({
  lines,
  lang,
  startLine = 1,
  marked = null,
  before,
  flagged
}: {
  readonly lines: readonly string[]
  readonly lang: CodeLang
  readonly startLine?: number
  readonly marked?: { readonly from: number; readonly to: number } | null
  readonly before?: (line: number) => React.ReactNode
  readonly flagged?: ReadonlySet<number>
}): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const colored = useMemo(() => {
    const tree = highlight(lines.join('\n'), LANGUAGES[lang])
    return tree === null ? null : splitHighlightLines(tree)
  }, [lines, lang])

  useEffect(() => {
    if (marked === null) return
    container.current?.querySelector(`[data-line="${marked.from}"]`)?.scrollIntoView?.({ block: 'center' })
  }, [marked])

  const isMarked = (line: number): boolean => marked !== null && line >= marked.from && line <= marked.to
  return (
    <div
      ref={container}
      className="min-h-0 overflow-auto rounded-md bg-surface-raised font-mono text-xs leading-5"
      tabIndex={0}
    >
      <code className="hljs block min-w-max py-1">
        {lines.map((text, index) => {
          const line = startLine + index
          const flag = flagged?.has(line) === true
          return (
            <Fragment key={line}>
              {before?.(line) ?? null}
              <span data-line={line} className={`flex ${isMarked(line) ? 'bg-accent/15' : flag ? 'bg-action/10' : ''}`}>
                <span aria-hidden="true" className="w-12 shrink-0 select-none pr-2 text-right text-content-muted">
                  {line}
                </span>
                <span className="whitespace-pre pr-2">
                  {colored?.[index] === undefined ? text || ' ' : <Highlighted nodes={colored[index] ?? []} />}
                </span>
                {flag ? (
                  <span className="pr-2 text-action" title="Appel repéré sur cette ligne">
                    ◀
                  </span>
                ) : null}
              </span>
            </Fragment>
          )
        })}
      </code>
    </div>
  )
}
