import { useState } from 'react'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'

/**
 * « Nouvelle conversation » avec un agent (demande de mentalyas, 2026-10-17) : une session Claude neuve, sans rien de
 * l'ancienne ; les messages affichés partent (le rapport de l'agent reste). Confirmé dans le volet, en deux temps.
 */
export function RestartChat({
  neuronId,
  disabled,
  onDone
}: {
  readonly neuronId: string
  /** L'agent répond : on attend la fin du tour. */
  readonly disabled: boolean
  readonly onDone: () => void
}): React.JSX.Element {
  const showToast = useUiStore((state) => state.showToast)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const restart = async (): Promise<void> => {
    setBusy(true)
    try {
      await call('chat:restart', { neuronId })
      setAsking(false)
      onDone()
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'La conversation n’a pas pu repartir de zéro.')
    } finally {
      setBusy(false)
    }
  }
  if (!asking) {
    return (
      <button
        type="button"
        className="card-button card-button-ghost"
        disabled={disabled}
        title={disabled ? 'L’agent répond : attends la fin du tour.' : 'Repartir d’une conversation neuve'}
        onClick={() => setAsking(true)}
      >
        Nouvelle conversation
      </button>
    )
  }
  return (
    <span role="alert" className="flex flex-wrap items-center gap-2 text-xs">
      Effacer cette conversation et repartir de zéro ?
      <button type="button" className="card-button card-button-primary" disabled={busy} onClick={() => void restart()}>
        Repartir
      </button>
      <button type="button" className="card-button card-button-ghost" onClick={() => setAsking(false)}>
        Garder
      </button>
    </span>
  )
}
