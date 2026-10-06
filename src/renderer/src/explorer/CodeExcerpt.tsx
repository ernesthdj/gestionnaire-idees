import { useQuery } from '@tanstack/react-query'
import type { CodeExcerptView } from '@shared/ipc/reprise'
import { CodeLines } from '../lib/CodeLines'
import { call, IpcFailure } from '../lib/ipc'

/**
 * Extrait de code d'un élément (spec 017 FR-025) : texte en lecture seule, coloré sans jamais interpréter de HTML,
 * avec ses numéros de ligne ; un fichier sensible n'est jamais montré (refusé par le main).
 */
export function CodeExcerpt({
  genesisId,
  symbolId
}: {
  readonly genesisId: string
  readonly symbolId: string
}): React.JSX.Element {
  const query = useQuery({
    queryKey: ['explorer', genesisId, 'code', symbolId],
    queryFn: () => call<CodeExcerptView>('explorer:code', { genesisId, symbolId })
  })
  const excerpt = query.data

  if (query.error !== null) {
    return (
      <p role="alert" className="text-sm text-con">
        {query.error instanceof IpcFailure ? query.error.message : 'Le code n’a pas pu être lu.'}
      </p>
    )
  }
  if (excerpt === undefined) return <p className="text-sm text-content-muted">Lecture du code…</p>
  return (
    <figure className="flex min-h-0 flex-col gap-1">
      <figcaption className="text-xs text-content-muted">
        {excerpt.path} · lignes {excerpt.startLine} à {excerpt.startLine + excerpt.lines.length - 1} · lecture seule
      </figcaption>
      <CodeLines lines={excerpt.lines} lang={excerpt.lang} startLine={excerpt.startLine} />
    </figure>
  )
}
