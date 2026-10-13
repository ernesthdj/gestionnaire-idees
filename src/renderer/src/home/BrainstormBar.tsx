import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { HubAnomaly } from '@shared/ipc/brainstorms'
import type { Confidentiality } from '@shared/ipc/reprise'
import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { flushViewState } from './useBrainstorms'
import { SavePoints } from '../canvas/SavePoints'
import { RepoBadge } from '../git/RepoBadge'
import { call, IpcFailure } from '../lib/ipc'

const since = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
}

/** Une anomalie de `/hub work` en mots (spec 024 US1 scénario 4). */
export function anomalyText(anomaly: HubAnomaly): string {
  switch (anomaly.kind) {
    case 'session_here':
      return `Une session /hub est ouverte sur ce projet depuis le ${since(anomaly.since)} (terminal).`
    case 'session_elsewhere':
      return `Une session /hub est restée ouverte sur « ${anomaly.slug} » depuis le ${since(anomaly.since)} : pense à /hub end.`
    case 'uncommitted':
      return `${anomaly.count} fichier${anomaly.count > 1 ? 's' : ''} non commité${anomaly.count > 1 ? 's' : ''} : volet Dépôt.`
    case 'unpushed':
      return `${anomaly.count} commit${anomaly.count > 1 ? 's' : ''} non poussé${anomaly.count > 1 ? 's' : ''}.`
    case 'behind':
      return `Le distant a ${anomaly.count} commit${anomaly.count > 1 ? 's' : ''} d’avance.`
  }
}

/**
 * Entrée directe de l'explorateur (spec 017) : « Explorateur » pour un projet repris (la carte du code par modules et
 * dossiers) ; « Analyser le code… » pour un projet qui a un dossier mais pas encore d'analyse (spec 017 D23), avec la
 * confidentialité choisie avant tout envoi (aucune valeur par défaut, FR-003).
 */
function ExplorerEntry({
  genesisId,
  hasFolder
}: {
  readonly genesisId: string
  readonly hasFolder: boolean
}): React.JSX.Element | null {
  const client = useQueryClient()
  const openExplorer = useUiStore((state) => state.openExplorer)
  const choiceId = useId()
  const [choosing, setChoosing] = useState(false)
  const [level, setLevel] = useState<Confidentiality | null>(null)
  const reprise = useQuery({
    queryKey: ['reprise', genesisId],
    queryFn: () => call('reprise:get', { genesisId }),
    retry: false
  })
  const adopt = useMutation({
    mutationFn: (confidentiality: Confidentiality) => call('reprise:adopt', { genesisId, confidentiality }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['reprise', genesisId] })
      setChoosing(false)
      openExplorer(genesisId)
    }
  })
  const failure = reprise.error instanceof IpcFailure ? reprise.error : null
  const notAnalyzed = failure?.code === 'NOT_FOUND'
  // Dossier déjà analysé pour un autre nœud (un ancien « Reprendre », D23) : son explorateur sert ce projet.
  const elsewhere = notAnalyzed ? failure?.details?.['analyzedBy'] : undefined
  const target = reprise.data !== undefined ? genesisId : typeof elsewhere === 'string' ? elsewhere : null
  if (target !== null) {
    return (
      <Button
        className="shrink-0"
        title="Carte du code : modules, dossiers, fichiers et symboles (« Réanalyser » la met à jour)"
        onClick={() => openExplorer(target)}
      >
        Explorateur
      </Button>
    )
  }
  if (!hasFolder || !notAnalyzed) return null
  return (
    <div className="relative shrink-0">
      <Button aria-expanded={choosing} onClick={() => setChoosing((open) => !open)}>
        Analyser le code…
      </Button>
      {choosing ? (
        <section
          aria-label="Analyser le code du projet"
          className="absolute top-full right-0 z-30 mt-1 flex w-80 flex-col gap-2 rounded-md border border-content-muted/30 bg-surface p-3 text-xs shadow-lg"
        >
          <p>
            L’app lit le dossier du projet et dessine la carte de son code (modules, dossiers, appels). Rien n’est
            modifié.
          </p>
          <fieldset className="flex flex-col gap-1">
            <legend className="font-semibold">Confidentialité</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name={choiceId} checked={level === 'local'} onChange={() => setLevel('local')} />
              Local uniquement : rien ne part chez Claude
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name={choiceId} checked={level === 'claude'} onChange={() => setLevel('claude')} />
              Claude autorisé : il peut lire le code (guide de reprise, liens précisés)
            </label>
          </fieldset>
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={level === null || adopt.isPending}
              onClick={() => level !== null && adopt.mutate(level)}
            >
              {adopt.isPending ? 'Analyse…' : 'Analyser'}
            </Button>
            <Button onClick={() => setChoosing(false)}>Annuler</Button>
          </div>
          {adopt.error === null ? null : (
            <p role="alert" className="text-con">
              {adopt.error instanceof IpcFailure ? adopt.error.message : 'L’analyse n’a pas pu démarrer.'}
            </p>
          )}
        </section>
      ) : null}
    </div>
  )
}

/**
 * Bandeau du brainstorm ouvert (spec 024) : son nom, retour au Project Manager, et ce que `/hub work` a relevé à
 * l'ouverture (anomalies, dernières entrées du JOURNAL), refermable. Les actions restent sur clic (volet Dépôt).
 */
export function BrainstormBar(): React.JSX.Element | null {
  const brainstorm = useUiStore((state) => state.brainstorm)
  const summary = useUiStore((state) => state.openSummary)
  const dismiss = useUiStore((state) => state.dismissSummary)
  const show = useUiStore((state) => state.show)
  const openRepo = useUiStore((state) => state.openRepo)
  if (brainstorm === null) return null
  const gitIssue = summary?.anomalies.some((anomaly) => anomaly.kind === 'uncommitted' || anomaly.kind === 'unpushed')
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-content-muted/20 px-4 py-2">
      <div className="flex items-center gap-3">
        <Button
          className="shrink-0"
          onClick={() => {
            // La vue est écrite tout de suite (sans attendre le différé) : fermer l'app juste après ne la perd pas.
            void flushViewState()
            show('home')
          }}
        >
          ← Projets
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold">{brainstorm.name}</span>
          {brainstorm.folder === null ? null : (
            <span className="ml-2 font-mono text-xs text-content-muted">{brainstorm.folder}</span>
          )}
        </p>
        {brainstorm.genesisId === null ? null : (
          <ExplorerEntry genesisId={brainstorm.genesisId} hasFolder={brainstorm.folder !== null} />
        )}
        {/* Entrée permanente du volet Dépôt (le bandeau d’ouverture se referme). */}
        {brainstorm.genesisId !== null && brainstorm.folder !== null ? (
          <RepoBadge genesisId={brainstorm.genesisId} variant="bar" />
        ) : null}
        <SavePoints brainstormId={brainstorm.id} />
      </div>
      {summary === null ? null : (
        <section
          aria-label="À l’ouverture"
          className="flex items-start gap-4 rounded-md border border-content-muted/30 bg-surface-raised p-3 text-xs"
        >
          {summary.anomalies.length === 0 ? null : (
            <ul className="flex flex-1 flex-col gap-1" aria-label="Points à regarder">
              {summary.anomalies.map((anomaly) => (
                <li key={anomaly.kind}>⚠ {anomalyText(anomaly)}</li>
              ))}
            </ul>
          )}
          {summary.journal.length === 0 ? null : (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-semibold">Dernières entrées du JOURNAL</p>
              <ul className="flex flex-col gap-1 text-content-muted">
                {summary.journal.slice(0, 3).map((entry) => (
                  <li key={entry} className="truncate" title={entry}>
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex shrink-0 flex-col gap-1">
            {gitIssue === true && brainstorm.genesisId !== null ? (
              <Button onClick={() => brainstorm.genesisId !== null && openRepo(brainstorm.genesisId)}>
                Ouvrir le volet Dépôt
              </Button>
            ) : null}
            <Button onClick={dismiss}>Fermer</Button>
          </div>
        </section>
      )}
    </div>
  )
}
