/** Écran pas encore livré (spec 003) : explique ce qui viendra, sans action trompeuse. */
export function SectionPlaceholder({ text }: { readonly text: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-md text-center text-sm text-content-muted">{text}</p>
    </div>
  )
}
