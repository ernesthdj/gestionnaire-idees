import type { GitDiffView } from '@shared/git/model'

const SIGN = { add: '+', del: '−', ctx: ' ' } as const

/**
 * Diff d'un fichier (spec 021 T016) : signe − / + en plus de la couleur, numéros de ligne, texte jamais interprété ;
 * binaire et diff tronqué dits en clair.
 */
export function DiffView({ diff }: { readonly diff: GitDiffView }): React.JSX.Element {
  if (diff.binary) return <p className="text-sm text-content-muted">Fichier binaire : différences non affichées.</p>
  if (diff.hunks.length === 0) {
    return (
      <p className="text-sm text-content-muted">
        {diff.truncated ? 'Fichier trop gros pour être affiché.' : 'Aucune différence.'}
      </p>
    )
  }
  return (
    <div className="overflow-auto rounded-md bg-surface-raised font-mono text-xs leading-5">
      {diff.hunks.map((hunk, index) => (
        <div key={`${hunk.header}-${index}`}>
          <p className="bg-surface px-2 text-content-muted">{hunk.header}</p>
          {hunk.lines.map((line, lineIndex) => (
            <p
              key={lineIndex}
              className={`flex whitespace-pre ${line.kind === 'add' ? 'bg-pro/15' : line.kind === 'del' ? 'bg-con/15' : ''}`}
            >
              <span aria-hidden="true" className="w-10 shrink-0 select-none pr-1 text-right text-content-muted">
                {line.oldNo ?? ''}
              </span>
              <span aria-hidden="true" className="w-10 shrink-0 select-none pr-1 text-right text-content-muted">
                {line.newNo ?? ''}
              </span>
              <span className="w-4 shrink-0 select-none text-center">{SIGN[line.kind]}</span>
              <span className="pr-2">{line.text || ' '}</span>
            </p>
          ))}
        </div>
      ))}
      {diff.truncated ? <p className="px-2 py-1 text-content-muted">Diff tronqué.</p> : null}
    </div>
  )
}
