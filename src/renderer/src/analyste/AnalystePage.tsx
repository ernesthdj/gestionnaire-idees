import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ANALYSIS_STEPS, type AnalysisProgressEvent, type AnalysisView, type ProposalView } from '@shared/ipc/analyste'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'
import { analysisErrorLabel, CATEGORY_LABELS, RISK_LABELS, SEVERITY_LABELS, STEP_LABELS } from './labels'

const ANALYSES_KEY = ['analyste', 'analyses'] as const
const PROPOSALS_KEY = ['analyste', 'proposals', 'todo'] as const
/** Relecture de l'état pendant une analyse : un événement manqué ne laisse jamais la page en attente. */
const POLL_MS = 5_000

type Notice =
  | { readonly kind: 'few'; readonly events: number; readonly minEvents: number }
  | { readonly kind: 'error'; readonly text: string }

function isProgress(payload: unknown): payload is AnalysisProgressEvent {
  if (typeof payload !== 'object' || payload === null) return false
  const { analysisId, step } = payload as Record<string, unknown>
  return (
    typeof analysisId === 'string' && typeof step === 'string' && (ANALYSIS_STEPS as readonly string[]).includes(step)
  )
}

const numberOf = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const dateOf = (ms: number): string => new Date(ms).toLocaleString('fr-FR')
const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? 's' : ''}`

function lastAnalysisText(analysis: AnalysisView | undefined): string {
  if (analysis === undefined) return 'Aucune analyse pour l’instant.'
  const when = dateOf(analysis.finishedAt ?? analysis.startedAt)
  switch (analysis.status) {
    case 'done':
      return `Dernière analyse : ${when} · ${plural(analysis.events, 'observation')} · ${plural(analysis.proposals, 'proposition')} gardée${analysis.proposals > 1 ? 's' : ''}.`
    case 'running':
      return `Analyse en cours depuis ${dateOf(analysis.startedAt)}.`
    case 'cancelled':
    case 'failed':
      return `Dernière analyse : ${when} — ${analysisErrorLabel(analysis.errorCode)}`
  }
}

function ProposalCard({ proposal }: { readonly proposal: ProposalView }): React.JSX.Element {
  const category = CATEGORY_LABELS[proposal.category]
  const severity = SEVERITY_LABELS[proposal.severity] ?? { icon: '·', label: String(proposal.severity) }
  const titleId = `proposal-${proposal.id}`
  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg bg-surface-raised p-4">
      <header className="space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-content-muted/40 px-2 py-0.5">
            <span aria-hidden="true">{category.icon} </span>
            {category.label}
          </span>
          <span className="rounded-md border border-content-muted/40 px-2 py-0.5">
            <span aria-hidden="true">{severity.icon} </span>
            Gravité : {severity.label}
          </span>
          <span className="text-content-muted">Risque {RISK_LABELS[proposal.risk]}</span>
          <span className="text-content-muted">Confiance {Math.round(proposal.confidence * 100)} %</span>
          {proposal.withoutEvidence ? (
            <span className="rounded-md border border-content-muted/40 px-2 py-0.5 italic">
              Idée, sans preuve d’usage
            </span>
          ) : null}
        </p>
        <h3 id={titleId} className="text-base font-semibold">
          {proposal.title}
        </h3>
      </header>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="font-medium">Constat</dt>
          <dd className="whitespace-pre-line">{proposal.finding}</dd>
        </div>
        <div>
          <dt className="font-medium">Proposition</dt>
          <dd className="whitespace-pre-line">{proposal.proposal}</dd>
        </div>
        <div>
          <dt className="font-medium">Gain attendu</dt>
          <dd>{proposal.gain}</dd>
        </div>
      </dl>
      {proposal.evidence.observations.length + proposal.evidence.code.length === 0 ? null : (
        <div className="text-sm">
          <h4 className="font-medium">Preuves</h4>
          <ul className="list-disc space-y-1 pl-5">
            {proposal.evidence.observations.map((item) => (
              <li key={item.key}>
                {item.sentence} <span className="text-xs text-content-muted">({item.key})</span>
              </li>
            ))}
            {proposal.evidence.code.map((item) => (
              <li key={`${item.path}:${item.start ?? ''}`}>
                <code className="text-xs">
                  {item.path}
                  {item.start === undefined ? '' : `:${item.start}${item.end === undefined ? '' : `–${item.end}`}`}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {proposal.files.length === 0 ? null : (
        <p className="text-xs text-content-muted">
          Fichiers visés : <code>{proposal.files.join(', ')}</code>
        </p>
      )}
    </article>
  )
}

/**
 * Boîte Analyste, version minimale (spec 019 US2) : lancer une analyse, suivre sa progression, voir les propositions
 * à trier. Le tri (accepter, refuser, reporter) arrive avec l'US3. Le texte des propositions est affiché comme texte.
 */
export function AnalystePage(): React.JSX.Element {
  const client = useQueryClient()
  const [progress, setProgress] = useState<AnalysisProgressEvent | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  const analyses = useQuery({
    queryKey: ANALYSES_KEY,
    queryFn: () => call<AnalysisView[]>('analyste:analyses', { limit: 5 }),
    refetchInterval: (query) => (query.state.data?.[0]?.status === 'running' ? POLL_MS : false)
  })
  const proposals = useQuery({
    queryKey: PROPOSALS_KEY,
    queryFn: () => call<{ items: ProposalView[] }>('analyste:proposals', { tab: 'todo' })
  })

  useEffect(
    () =>
      window.api.on('analyste:progress', (payload) => {
        if (!isProgress(payload)) return
        setProgress(payload)
        if (payload.step === 'fini' || payload.step === 'echec') {
          void client.invalidateQueries({ queryKey: ['analyste'] })
        }
      }),
    [client]
  )

  const latest = analyses.data?.[0]
  const liveStep = progress === null || progress.step === 'fini' || progress.step === 'echec' ? null : progress.step
  const running = liveStep !== null || latest?.status === 'running'
  const runningId =
    liveStep !== null && progress !== null ? progress.analysisId : latest?.status === 'running' ? latest.id : null

  const analyze = async (force: boolean): Promise<void> => {
    setBusy(true)
    setNotice(null)
    try {
      const { analysisId } = await call<{ analysisId: string }>('analyste:analyze', force ? { force: true } : {})
      setProgress((current) => (current?.analysisId === analysisId ? current : { analysisId, step: 'dossier' }))
      void client.invalidateQueries({ queryKey: ANALYSES_KEY })
    } catch (error) {
      if (error instanceof IpcFailure && error.code === 'NOT_ENOUGH_DATA') {
        setNotice({
          kind: 'few',
          events: numberOf(error.details?.['events']),
          minEvents: numberOf(error.details?.['minEvents'])
        })
      } else {
        setNotice({ kind: 'error', text: analysisErrorLabel(error instanceof IpcFailure ? error.code : null) })
      }
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (): Promise<void> => {
    if (runningId === null) return
    setBusy(true)
    try {
      await call('analyste:cancel', { analysisId: runningId })
    } catch (error) {
      setNotice({ kind: 'error', text: analysisErrorLabel(error instanceof IpcFailure ? error.code : null) })
      void client.invalidateQueries({ queryKey: ANALYSES_KEY })
    } finally {
      setBusy(false)
    }
  }

  const items = proposals.data?.items ?? []
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
        <section aria-labelledby="analyste-run" className="space-y-3 rounded-lg bg-surface-raised p-4">
          <h2 id="analyste-run" className="text-base font-semibold">
            Analyse
          </h2>
          <p className="text-sm text-content-muted">
            {analyses.isError ? 'L’historique des analyses est illisible.' : lastAnalysisText(latest)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy || running} onClick={() => void analyze(false)}>
              Analyser maintenant
            </Button>
            {running ? (
              <Button disabled={busy || runningId === null} onClick={() => void cancel()}>
                Annuler l’analyse
              </Button>
            ) : null}
          </div>
          <div role="status" className="text-sm">
            {liveStep === null ? null : STEP_LABELS[liveStep]}
            {progress?.step === 'fini'
              ? `Analyse terminée : ${plural(progress.proposals ?? 0, 'proposition')} gardée${(progress.proposals ?? 0) > 1 ? 's' : ''}.`
              : null}
          </div>
          {progress?.step === 'echec' ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {analysisErrorLabel(progress.errorCode)}
            </p>
          ) : null}
          {notice?.kind === 'few' ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                Peu d’observations nouvelles depuis la dernière analyse ({notice.events} pour un seuil de{' '}
                {notice.minEvents}) : les propositions risquent d’être pauvres.
              </p>
              <Button disabled={busy} onClick={() => void analyze(true)}>
                Analyser quand même
              </Button>
            </div>
          ) : null}
          {notice?.kind === 'error' ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {notice.text}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="analyste-proposals" className="space-y-3">
          <h2 id="analyste-proposals" className="text-base font-semibold">
            Propositions à trier
          </h2>
          {proposals.isError ? (
            <p role="alert" className="text-sm">
              Les propositions sont illisibles :{' '}
              {proposals.error instanceof IpcFailure ? analysisErrorLabel(proposals.error.code) : 'erreur inconnue'}
            </p>
          ) : proposals.isPending ? (
            <p className="text-sm text-content-muted">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-content-muted">
              Aucune proposition à trier. Lance une analyse : chaque proposition dira ce qui a été constaté, avec ses
              preuves.
            </p>
          ) : (
            items.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)
          )}
          <p className="text-xs text-content-muted">
            L’Analyste ne modifie rien : il propose. Le tri (garder, refuser, reporter) arrive dans une prochaine
            version.
          </p>
        </section>
      </div>
    </div>
  )
}
