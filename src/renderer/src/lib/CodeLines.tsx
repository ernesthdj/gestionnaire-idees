import { useEffect, useMemo, useRef } from 'react'
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
 * partir de `startLine` ; une plage peut être mise en avant, et la vue se place sur sa première ligne.
 */
export function CodeLines({
  lines,
  lang,
  startLine = 1,
  marked = null
}: {
  readonly lines: readonly string[]
  readonly lang: CodeLang
  readonly startLine?: number
  readonly marked?: { readonly from: number; readonly to: number } | null
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
      className="flex min-h-0 overflow-auto rounded-md bg-surface-raised font-mono text-xs leading-5"
      tabIndex={0}
    >
      <pre aria-hidden="true" className="select-none px-2 text-right text-content-muted">
        {lines.map((_, index) => `${startLine + index}\n`).join('')}
      </pre>
      <pre className="min-w-0 flex-1 pr-2">
        <code className="hljs">
          {lines.map((text, index) => (
            <span
              key={index}
              data-line={startLine + index}
              className={`block ${isMarked(startLine + index) ? 'bg-accent/15' : ''}`}
            >
              {colored?.[index] === undefined ? text || ' ' : <Highlighted nodes={colored[index] ?? []} />}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
