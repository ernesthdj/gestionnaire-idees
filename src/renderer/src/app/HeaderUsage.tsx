import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ChatUsageView, UsageWindowView } from '@shared/ipc/chat'
import { formatTokens, resetLabel } from '../chat/UsageMeter'
import { call } from '../lib/ipc'

export const USAGE_KEY = ['usage'] as const
/** Relecture de secours (la base locale, pas Claude) ; l'essentiel arrive par `chat:usage`. */
const REFRESH_MS = 60_000

function percentOf(window: UsageWindowView | null): number | null {
  return window === null ? null : Math.round(window.utilization * 100)
}

function tone(percent: number | null): string {
  if (percent === null) return 'bg-content-muted/30'
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 75) return 'bg-amber-500'
  return 'bg-accent'
}

/** « il y a 4 min » : ancienneté du relevé de l'abonnement (il arrive avec les réponses de Claude). */
function ageLabel(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} j`
}

function MiniGauge({
  label,
  window
}: {
  readonly label: string
  readonly window: UsageWindowView | null
}): React.JSX.Element {
  const percent = percentOf(window)
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-content-muted">{label}</span>
      <span
        role="meter"
        aria-label={`${label === '5 h' ? 'Session de 5 h' : 'Semaine'} de l’abonnement Claude`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? 0}
        aria-valuetext={
          percent === null ? 'inconnu' : `${percent} %${window === null ? '' : `, ${resetLabel(window.resetsAt)}`}`
        }
        className="h-1.5 w-12 overflow-hidden rounded-full bg-content-muted/20"
      >
        <span className={`block h-full ${tone(percent)}`} style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
      </span>
      <span className="w-8 text-right font-semibold tabular-nums">{percent === null ? '—' : `${percent} %`}</span>
    </span>
  )
}

/**
 * Consommation de l'abonnement Claude, visible en permanence dans l'en-tête (à côté du thème) : session de 5 h et
 * semaine, d'après le dernier relevé du CLI ; mise à jour à chaque réponse de Claude, où qu'elle ait lieu.
 */
export function HeaderUsage(): React.JSX.Element {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: USAGE_KEY,
    queryFn: () => call<ChatUsageView>('usage:get'),
    refetchInterval: REFRESH_MS
  })
  // Chaque relevé d'une conversation vaut pour tout le compte : on le reprend tel quel.
  useEffect(
    () =>
      window.api.on('chat:usage', (payload) => {
        const usage = (payload as { usage?: ChatUsageView } | null)?.usage
        if (usage !== undefined) client.setQueryData(USAGE_KEY, usage)
      }),
    [client]
  )

  const usage = query.data
  const account = usage?.account ?? null
  const details =
    usage === undefined
      ? 'Consommation de l’abonnement Claude'
      : [
          account === null
            ? 'Pas encore de relevé : il arrive avec la première réponse de Claude.'
            : `Abonnement Claude, tous usages confondus — relevé ${ageLabel(account.updatedAt)}.`,
          account?.fiveHour == null ? null : `Session 5 h : ${resetLabel(account.fiveHour.resetsAt)}.`,
          account?.sevenDay == null ? null : `Semaine : ${resetLabel(account.sevenDay.resetsAt)}.`,
          account?.status === 'rejected' ? 'Limite atteinte pour l’instant.' : null,
          `Brainstormer cette semaine : ${formatTokens(usage.app.weekTokens)} jetons (${usage.app.weekTurns} échanges).`
        ]
          .filter((line) => line !== null)
          .join('\n')

  return (
    <div
      role="group"
      aria-label="Consommation Claude"
      title={details}
      className={`flex items-center gap-3 rounded-md bg-surface-raised px-2 py-1 text-[11px]${account?.status === 'rejected' ? ' ring-1 ring-red-500' : ''}`}
    >
      <span className="font-semibold">Claude</span>
      <MiniGauge label="5 h" window={account?.fiveHour ?? null} />
      <MiniGauge label="7 j" window={account?.sevenDay ?? null} />
    </div>
  )
}
