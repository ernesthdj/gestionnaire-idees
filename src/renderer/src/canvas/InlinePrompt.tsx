import { useId, useState } from 'react'

interface InlinePromptProps {
  /** Position à l'écran, relative à la surface de la carte. */
  readonly at: { readonly x: number; readonly y: number }
  readonly label: string
  readonly placeholder: string
  readonly maxLength: number
  /** Enregistre la saisie ; `false` garde le champ ouvert (échec annoncé ailleurs). */
  readonly onSubmit: (text: string) => Promise<boolean>
  readonly onCancel: () => void
}

/**
 * Petit champ posé sur la carte à l'endroit du geste (double-clic → idée, lien tiré → libellé). `Entrée` valide,
 * `Échap` ou un champ vide quitté annule.
 */
export function InlinePrompt({
  at,
  label,
  placeholder,
  maxLength,
  onSubmit,
  onCancel
}: InlinePromptProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const id = useId()

  const submit = async (): Promise<void> => {
    if (text.trim() === '' || busy) return
    setBusy(true)
    const done = await onSubmit(text.trim())
    if (!done) setBusy(false)
  }

  return (
    <div
      className="nodrag nopan absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-content-muted/30 bg-surface p-2 shadow-lg"
      style={{ left: at.x, top: at.y }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        autoFocus
        value={text}
        maxLength={maxLength}
        readOnly={busy}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void submit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          }
        }}
        onBlur={() => {
          if (text.trim() === '') onCancel()
        }}
        className="h-8 w-64 rounded-md bg-surface-raised px-2 text-sm"
      />
    </div>
  )
}
