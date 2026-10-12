/** Bascule à deux positions de l'en-tête d'un lecteur (« Mis en forme | Texte brut » d'un fichier Markdown). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded px-1.5 py-0.5 text-xs hover:bg-surface-raised ${
            value === option.value ? 'bg-accent/15 font-semibold' : 'text-content-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
