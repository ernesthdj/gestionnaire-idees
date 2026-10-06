import type { ChatUsageView, UsageWindowView } from '@shared/ipc/chat'

/** Jetons lisibles : 950 · 12,4 k · 3,1 M. */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens)
  if (tokens < 1_000_000) return `${(tokens / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 1 })} k`
  return `${(tokens / 1_000_000).toLocaleString('fr-BE', { maximumFractionDigits: 1 })} M`
}

export function resetLabel(resetsAt: number | null): string {
  if (resetsAt === null) return ''
  return `remise à zéro ${new Date(resetsAt * 1000).toLocaleString('fr-BE', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })}`
}

function Gauge({
  label,
  window
}: {
  readonly label: string
  readonly window: UsageWindowView | null
}): React.JSX.Element {
  const percent = window === null ? null : Math.round(window.utilization * 100)
  const tone =
    percent === null
      ? 'bg-content-muted/30'
      : percent >= 90
        ? 'bg-red-500'
        : percent >= 75
          ? 'bg-amber-500'
          : 'bg-accent'
  return (
    <div className="min-w-0 flex-1" title={window === null ? undefined : resetLabel(window.resetsAt)}>
      <div className="flex justify-between gap-2 text-[11px]">
        <span>{label}</span>
        <span className="font-semibold">{percent === null ? '—' : `${percent} %`}</span>
      </div>
      <div
        role="meter"
        aria-label={`${label} de l’abonnement`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? 0}
        aria-valuetext={
          percent === null ? 'inconnu' : `${percent} %${window === null ? '' : `, ${resetLabel(window.resetsAt)}`}`
        }
        className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-content-muted/20"
      >
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
      </div>
    </div>
  )
}

/**
 * Consommation dans le chat (spec 008) : l'abonnement Claude de mentalyas, tous usages confondus (session de 5 h et
 * semaine), d'après le dernier relevé du CLI ; et ce que le Brainstormer a consommé (cette semaine, au total, ce neurone).
 */
export function UsageMeter({ usage }: { readonly usage: ChatUsageView }): React.JSX.Element {
  const { account, app } = usage
  return (
    <details className="border-b border-content-muted/20 px-4 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="shrink-0 text-content-muted">Abonnement</span>
        <Gauge label="Session 5 h" window={account?.fiveHour ?? null} />
        <Gauge label="Semaine" window={account?.sevenDay ?? null} />
      </summary>
      <div className="mt-2 space-y-1 text-content-muted">
        {account === null ? (
          <p>Pas encore de relevé : il arrive avec la première réponse de Claude.</p>
        ) : (
          <p>
            Tous usages de ton compte confondus (CLI, app…).
            {account.sevenDay === null ? '' : ` Semaine : ${resetLabel(account.sevenDay.resetsAt)}.`}
            {account.status === 'rejected' ? ' Limite atteinte pour l’instant.' : ''}
          </p>
        )}
        <p>
          Brainstormer — cette semaine : {formatTokens(app.weekTokens)} jetons ({app.weekTurns} échanges) · au total :{' '}
          {formatTokens(app.totalTokens)} ({app.totalTurns}) · ce neurone : {formatTokens(app.neuronTokens)} (
          {app.neuronTurns})
        </p>
      </div>
    </details>
  )
}
