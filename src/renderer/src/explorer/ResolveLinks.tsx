import { useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { Confidentiality, RepriseProjectView, ResolutionResultView } from '@shared/ipc/reprise'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

const plural = (count: number, one: string, many: string): string => `${count} ${count > 1 ? many : one}`

/** Phrase de fin de passe : ce qui a été précisé, ce qui reste incertain, et pourquoi (arrêt de l'IA). */
export function resolutionMessage(result: ResolutionResultView): string {
  const parts: string[] = []
  parts.push(
    result.deduced === 0
      ? 'Aucun lien n’a pu être précisé.'
      : `${plural(result.deduced, 'lien précisé', 'liens précisés')} (« déduit », avec sa raison).`
  )
  if (result.undecided > 0) {
    parts.push(
      `${plural(result.undecided, 'lien reste', 'liens restent')} incertain${result.undecided > 1 ? 's' : ''} : l’IA n’a pas pu trancher.`
    )
  }
  if (result.stopped) {
    parts.push(
      `L’IA est devenue indisponible : ${plural(result.remaining, 'lien est laissé', 'liens sont laissés')} incertain${result.remaining > 1 ? 's' : ''}, relance plus tard.`
    )
  } else if (result.remaining > 0) {
    parts.push(`${plural(result.remaining, 'lien reste', 'liens restent')} à préciser : relance pour continuer.`)
  }
  return parts.join(' ')
}

/**
 * « Préciser les liens avec l'IA » (spec 017 US6) : demande à Claude — ou au modèle local si le projet est « Local
 * uniquement » — de choisir, parmi les cibles possibles, celle d'un appel ambigu. Les liens précisés passent en
 * « déduit » avec leur raison (visible dans le panneau de l'élément) ; rien n'est jamais présenté comme sûr.
 */
export function ResolveLinks({
  genesisId,
  resolution,
  confidentiality,
  disabled
}: {
  readonly genesisId: string
  readonly resolution: RepriseProjectView['resolution']
  readonly confidentiality: Confidentiality
  /** Pas de projet analysé, ou analyse en cours. */
  readonly disabled: boolean
}): React.JSX.Element {
  const client = useQueryClient()
  const hintId = useId()
  const [asked, setAsked] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const running = resolution.running || asked

  const run = async (): Promise<void> => {
    setProblem(null)
    setMessage(null)
    setAsked(true)
    try {
      setMessage(resolutionMessage(await call<ResolutionResultView>('reprise:resolve', { genesisId })))
    } catch (error) {
      setProblem(error instanceof IpcFailure ? error.message : 'Les liens n’ont pas pu être précisés.')
    } finally {
      setAsked(false)
      void client.invalidateQueries({ queryKey: ['reprise', genesisId] })
      void client.invalidateQueries({ queryKey: ['explorer', genesisId] })
    }
  }

  const hint =
    confidentiality === 'local'
      ? 'Le modèle local lit quelques lignes autour de chaque appel ambigu ; rien ne part vers Claude.'
      : 'Claude lit quelques lignes autour de chaque appel ambigu (pas le fichier entier) et choisit la cible.'
  return (
    <div className="flex flex-wrap items-center gap-2">
      {running ? (
        <p role="status" className="text-xs">
          Précision des liens en cours…
        </p>
      ) : (
        <Button onClick={() => void run()} disabled={disabled || resolution.pending === 0} aria-describedby={hintId}>
          Préciser les liens avec l’IA
          {resolution.pending === 0 ? '' : ` (${resolution.pending})`}
        </Button>
      )}
      <span id={hintId} className="sr-only">
        {resolution.pending === 0
          ? 'Aucun lien incertain à préciser.'
          : `${plural(resolution.pending, 'lien incertain', 'liens incertains')}. ${hint}`}
      </span>
      {message === null ? null : (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
      {problem === null ? null : (
        <p role="alert" className="text-xs text-con">
          {problem}
        </p>
      )}
    </div>
  )
}
