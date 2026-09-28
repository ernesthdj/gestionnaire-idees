import type { GaugeView } from '@shared/ipc/neurons'

const LEVELS = {
  insufficient: { value: 1, label: 'insuffisant' },
  sufficient: { value: 2, label: 'suffisant' },
  complete: { value: 3, label: 'complet' }
} as const

/** Jauge de contexte (FR-014) : niveau (barre en 3 crans) et ce qui manque encore. */
export function Gauge({ gauge }: { readonly gauge: GaugeView | null }): React.JSX.Element {
  const level = gauge === null ? null : LEVELS[gauge.level]
  return (
    <section aria-label="Jauge de contexte" className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Contexte</span>
        <span className="text-content-muted">{level === null ? 'pas encore évalué' : level.label}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Niveau de contexte"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={level?.value ?? 0}
        aria-valuetext={level?.label ?? 'pas encore évalué'}
        className="flex gap-1"
      >
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-2 flex-1 rounded-full ${(level?.value ?? 0) >= step ? 'bg-accent' : 'bg-content-muted/25'}`}
          />
        ))}
      </div>
      {gauge !== null && gauge.missing.length > 0 ? (
        <p className="text-xs text-content-muted">Il manque : {gauge.missing.join(', ')}</p>
      ) : null}
    </section>
  )
}
