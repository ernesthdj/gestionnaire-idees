import { useEffect } from 'react'
import { Button } from '../components/atoms/Button'
import { IpcFailure } from '../lib/ipc'
import { AuthorChip } from './ReplayBar'
import type { UpdatesMarks } from './useUpdatesMarks'

/**
 * Barre « Depuis ta dernière visite » en bas de l'explorateur (spec 021 T030, D13) : combien de commits sont arrivés,
 * combien d'éléments du niveau ouvert ils touchent, la légende des auteurs, « Quitter » ou `Échap`. « Marquer comme
 * vu » reste dans le volet Dépôt.
 */
export function UpdatesBar({
  updates,
  onQuit
}: {
  readonly updates: UpdatesMarks
  readonly onQuit: () => void
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onQuit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onQuit])
  const { commits, marks, authors, error } = updates
  return (
    <section
      aria-label="Depuis ta dernière visite"
      className="flex flex-col gap-2 border-t border-content-muted/20 px-4 py-2 text-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1" aria-live="polite">
          {commits === undefined
            ? error === null
              ? 'Lecture des nouveautés…'
              : ''
            : commits === 0
              ? 'Rien de nouveau depuis ta dernière visite.'
              : `✦ ${commits} commit${commits > 1 ? 's' : ''} depuis ta dernière visite : ${marks.size} élément${
                  marks.size > 1 ? 's' : ''
                } touché${marks.size > 1 ? 's' : ''} à ce niveau.`}
        </p>
        <Button onClick={onQuit}>Quitter les nouveautés</Button>
      </div>
      {authors.length === 0 ? null : (
        <ul aria-label="Légende des auteurs" className="flex flex-wrap gap-2">
          {authors.map((author) => (
            <li key={author.key} className="flex items-center gap-1">
              <AuthorChip mark={{ author, shares: [] }} />
              {author.name}
            </li>
          ))}
          <li className="flex items-center gap-1 text-content-muted">
            <AuthorChip mark={null} /> pas touché
          </li>
        </ul>
      )}
      {error === null ? null : (
        <p role="alert" className="text-con">
          {error instanceof IpcFailure ? error.message : 'Les nouveautés n’ont pas pu être lues.'}
        </p>
      )}
    </section>
  )
}
