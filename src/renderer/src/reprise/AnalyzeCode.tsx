import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { Confidentiality, RepriseProjectView } from '@shared/ipc/reprise'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

/**
 * Analyse du code d'un projet (spec 017 D23) : `target`, le genesis dont l'explorateur sert ce projet (le sien, ou
 * celui d'un ancien « Reprendre » du même dossier) ; `notAnalyzed` : aucune analyse, elle peut être lancée.
 */
export function useCodeAnalysis(genesisId: string): {
  readonly target: string | null
  readonly notAnalyzed: boolean
  readonly loading: boolean
} {
  const reprise = useQuery({
    queryKey: ['reprise', genesisId],
    queryFn: () => call<RepriseProjectView>('reprise:get', { genesisId }),
    retry: false
  })
  const failure = reprise.error instanceof IpcFailure ? reprise.error : null
  const notAnalyzed = failure?.code === 'NOT_FOUND'
  const elsewhere = notAnalyzed ? failure?.details?.['analyzedBy'] : undefined
  const target = reprise.data !== undefined ? genesisId : typeof elsewhere === 'string' ? elsewhere : null
  return { target, notAnalyzed: notAnalyzed && target === null, loading: reprise.isPending }
}

/** « Analyser le code » d'un projet lié à un dossier : la confidentialité est choisie avant tout envoi (FR-003). */
export function AnalyzeCodeForm({
  genesisId,
  onAnalyzed,
  onCancel
}: {
  readonly genesisId: string
  readonly onAnalyzed: () => void
  readonly onCancel?: () => void
}): React.JSX.Element {
  const client = useQueryClient()
  const choiceId = useId()
  const [level, setLevel] = useState<Confidentiality | null>(null)
  const adopt = useMutation({
    mutationFn: (confidentiality: Confidentiality) => call('reprise:adopt', { genesisId, confidentiality }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['reprise', genesisId] })
      onAnalyzed()
    }
  })
  return (
    <>
      <p>
        L’app lit le dossier du projet et dessine la carte de son code (modules, dossiers, appels). Rien n’est modifié.
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
        {onCancel === undefined ? null : <Button onClick={onCancel}>Annuler</Button>}
      </div>
      {adopt.error === null ? null : (
        <p role="alert" className="text-con">
          {adopt.error instanceof IpcFailure ? adopt.error.message : 'L’analyse n’a pas pu démarrer.'}
        </p>
      )}
    </>
  )
}
