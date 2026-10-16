import { useMemo } from 'react'
import { highlight } from './highlight'
import { Highlighted } from './Highlighted'

/**
 * Contenu d'un fichier en lecture seule : coloré selon son langage (jamais de HTML interprété), lignes numérotées.
 * Partagé par la visionneuse des livrables (spec 013 D4) et la fenêtre des pastilles de fichier (spec 014 D9).
 */
export function SourceCode({
  text,
  language
}: {
  readonly text: string
  readonly language: string | null
}): React.JSX.Element {
  const tree = useMemo(() => highlight(text, language), [text, language])
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
