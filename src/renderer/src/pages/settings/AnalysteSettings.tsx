import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ANALYSTE_SETTINGS_LIMITS as LIMITS,
  type AnalysteSettingsView,
  type AnalysteStatusView
} from '@shared/ipc/analyste'
import { REASON_LABELS } from '../../analyste/labels'
import { ANALYSTE_STATUS_KEY, useAnalysteStatusQuery } from '../../analyste/useAnalysteStatus'
import { Button } from '../../components/atoms/Button'
import { Section } from '../../components/molecules/Section'
import { call, IpcFailure } from '../../lib/ipc'
import { ObservationsPage } from './ObservationsPage'

const SETTINGS_KEY = ['analyste', 'settings'] as const

const KEPT = [
  'l’écran ouvert et le temps passé dessus',
  'l’action faite (idée créée, lien, annulation, message envoyé…) et le type d’objet, par un pseudonyme',
  'le type d’une erreur et l’endroit du code où elle s’est produite',
  'la durée de chaque échange interne de l’app',
  'pour une tâche d’IA, une empreinte chiffrée de son entrée et de sa sortie'
]
const NEVER = [
  'le texte que tu écris (idées, notes, messages, titres)',
  'le message d’une erreur',
  'un nom de fichier personnel ou un chemin hors du dépôt',
  'l’identifiant réel d’une idée'
]

/**
 * Réglages › Analyste (spec 019 US1, E5) : désigner le dépôt source, voir ce que la sonde garde, régler la
 * conservation, consulter, exporter ou effacer les observations.
 */
export function AnalysteSettings(): React.JSX.Element {
  const client = useQueryClient()
  const statusQuery = useAnalysteStatusQuery()
  const status = statusQuery.data
  const settings = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => call<AnalysteSettingsView>('analyste:settings:get'),
    enabled: status?.available === true
  }).data
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showObservations, setShowObservations] = useState(false)
  const [draft, setDraft] = useState<AnalysteSettingsView | null>(null)

  const run = async (work: () => Promise<string>, failure: string): Promise<void> => {
    setBusy(true)
    try {
      setMessage(await work())
    } catch (error) {
      setMessage(error instanceof IpcFailure && error.code !== 'CANCELLED' ? error.message : failure)
    } finally {
      setBusy(false)
    }
  }
  const refresh = async (): Promise<void> => {
    await client.invalidateQueries({ queryKey: ['analyste'] })
  }

  if (status === undefined) {
    return statusQuery.isError ? (
      <p role="alert" className="p-8 text-center text-sm">
        L’état de l’Analyste est illisible :{' '}
        {statusQuery.error instanceof IpcFailure ? statusQuery.error.message : 'erreur inconnue'}.
      </p>
    ) : (
      <p className="p-8 text-center text-sm text-content-muted">Chargement…</p>
    )
  }

  if (!status.available) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <Section title="Analyste">
          <p className="text-sm">{REASON_LABELS.PACKAGED_APP}</p>
        </Section>
      </div>
    )
  }

  const values = draft ?? settings
  const choose = (): Promise<void> =>
    run(async () => {
      client.setQueryData<AnalysteStatusView>(ANALYSTE_STATUS_KEY, await call('analyste:repo:choose'))
      await refresh()
      return 'Dépôt reconnu : la sonde est active.'
    }, 'Aucun dépôt choisi.')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <Section
        title="Dépôt source"
        description="L’Analyste observe le Brainstormer quand il tourne depuis ce dépôt (npm run dev), et seulement là."
      >
        {status.active ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Sonde active
          </p>
        ) : (
          <p className="text-sm">{REASON_LABELS[status.reason ?? 'NOT_DESIGNATED']}</p>
        )}
        {status.repoPath === null ? null : (
          <code className="block truncate text-xs" title={status.repoPath}>
            {status.repoPath}
          </code>
        )}
        <div>
          <Button variant="secondary" disabled={busy} onClick={() => void choose()}>
            {status.repoPath === null ? 'Désigner le dépôt…' : 'Changer de dépôt…'}
          </Button>
        </div>
      </Section>

      <Section title="Ce que la sonde garde">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-medium">Gardé</h3>
            <ul className="list-disc space-y-1 pl-5">
              {KEPT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 font-medium">Jamais gardé</h3>
            <ul className="list-disc space-y-1 pl-5">
              {NEVER.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {values === undefined ? null : (
        <Section title="Conservation" description="Les observations les plus anciennes sont effacées d’abord.">
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                client.setQueryData(SETTINGS_KEY, await call<AnalysteSettingsView>('analyste:settings:set', values))
                setDraft(null)
                return 'Conservation enregistrée.'
              }, 'La conservation n’a pas pu être enregistrée.')
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              Durée (jours)
              <input
                type="number"
                min={LIMITS.retentionDays.min}
                max={LIMITS.retentionDays.max}
                value={values.retentionDays}
                onChange={(event) => setDraft({ ...values, retentionDays: Number(event.target.value) })}
                className="h-8 w-28 rounded-md border border-content-muted/40 bg-surface px-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Nombre maximal
              <input
                type="number"
                min={LIMITS.maxEvents.min}
                max={LIMITS.maxEvents.max}
                step={1000}
                value={values.maxEvents}
                onChange={(event) => setDraft({ ...values, maxEvents: Number(event.target.value) })}
                className="h-8 w-32 rounded-md border border-content-muted/40 bg-surface px-2"
              />
            </label>
            <Button type="submit" variant="secondary" disabled={busy || draft === null}>
              Enregistrer
            </Button>
          </form>
        </Section>
      )}

      <Section
        title="Observations"
        description={`${status.observations} gardée${status.observations > 1 ? 's' : ''}${
          status.dropped > 0
            ? ` · ${status.dropped} ignorée${status.dropped > 1 ? 's' : ''} (rafales ou invalides)`
            : ''
        }`}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowObservations(!showObservations)}>
            {showObservations ? 'Masquer les observations' : 'Voir les observations'}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const { count } = await call<{ count: number }>('analyste:observations:export')
                return `${count} observation${count > 1 ? 's' : ''} exportée${count > 1 ? 's' : ''}.`
              }, 'Export annulé.')
            }
          >
            Exporter…
          </Button>
          {confirming ? (
            <>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const { deleted } = await call<{ deleted: number }>('analyste:purge', { confirm: true })
                    setConfirming(false)
                    await refresh()
                    return `${deleted} observation${deleted > 1 ? 's' : ''} effacée${deleted > 1 ? 's' : ''}.`
                  }, 'Les observations n’ont pas pu être effacées.')
                }
              >
                Confirmer l’effacement
              </Button>
              <Button onClick={() => setConfirming(false)}>Garder</Button>
            </>
          ) : (
            <Button variant="danger" disabled={busy || status.observations === 0} onClick={() => setConfirming(true)}>
              Effacer les observations
            </Button>
          )}
        </div>
        {showObservations ? <ObservationsPage /> : null}
      </Section>
      <p role="status" className="text-sm">
        {message}
      </p>
    </div>
  )
}
