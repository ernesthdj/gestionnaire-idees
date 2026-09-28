import { MAX_AI_DEPTH } from './diveModel'

interface BreadcrumbProps {
  readonly steps: readonly { readonly id: string; readonly title: string }[]
  readonly onIdeas: () => void
  readonly onStep: (id: string) => void
}

/** Fil d'Ariane (FR-013) : Idées › idée › sous-neurone…, chaque étape permet de remonter ; badge de profondeur. */
export function Breadcrumb({ steps, onIdeas, onStep }: BreadcrumbProps): React.JSX.Element {
  const depth = steps.length - 1
  return (
    <div className="flex min-w-0 items-center gap-3">
      <nav aria-label="Fil d’Ariane" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1 text-sm">
          <li>
            <button type="button" onClick={onIdeas} className="rounded px-1 text-content-muted hover:underline">
              Idées
            </button>
          </li>
          {steps.map((step, index) => {
            const last = index === steps.length - 1
            return (
              <li key={step.id} className="flex min-w-0 items-center gap-1">
                <span aria-hidden="true" className="text-content-muted">
                  ›
                </span>
                {last ? (
                  <span aria-current="page" className="truncate font-semibold">
                    {step.title}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStep(step.id)}
                    className="max-w-40 truncate rounded px-1 text-content-muted hover:underline"
                  >
                    {step.title}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      {depth > 0 ? (
        <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-content-muted">
          Profondeur {depth}/{MAX_AI_DEPTH}
        </span>
      ) : null}
    </div>
  )
}
