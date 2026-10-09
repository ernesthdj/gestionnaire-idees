import { useId, type ReactNode } from 'react'

interface SectionProps {
  readonly title: string
  readonly description?: string | undefined
  readonly children: ReactNode
}

/** Bloc de réglages délimité (Gestalt : fermeture), titre + aide courte + contenu. */
export function Section({ title, description, children }: SectionProps): React.JSX.Element {
  // Identifiant unique : deux sections au même titre (ou aux titres accentués) ne partagent jamais leur libellé.
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-lg bg-surface-raised p-4">
      <header className="space-y-1">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description === undefined ? null : <p className="text-sm text-content-muted">{description}</p>}
      </header>
      {children}
    </section>
  )
}
