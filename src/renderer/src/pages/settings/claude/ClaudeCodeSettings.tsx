import { useCallback, useEffect, useId, useState } from 'react'
import type { McpStatusView } from '@shared/ipc/mcp'
import { Button } from '../../../components/atoms/Button'
import { Section } from '../../../components/molecules/Section'

/**
 * Réglages › Claude Code (spec 007 US5) : état du pont MCP, commande d'enregistrement à copier (sans secret) et
 * régénération du secret. L'installation automatique arrive au lot 3.
 */
export function ClaudeCodeSettings(): React.JSX.Element {
  const [status, setStatus] = useState<McpStatusView | null>(null)
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const commandId = useId()

  const refresh = useCallback(async (): Promise<void> => {
    const result = await window.api.invoke<McpStatusView>('mcp:status')
    if (result.success) setStatus(result.data)
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [refresh])

  const copy = async (): Promise<void> => {
    if (status === null) return
    try {
      await navigator.clipboard.writeText(status.command)
      setMessage('Commande copiée : colle-la dans un terminal (PowerShell ou Git Bash).')
    } catch {
      setMessage('Copie impossible : sélectionne la commande et copie-la à la main.')
    }
  }

  const rotate = async (): Promise<void> => {
    setConfirming(false)
    const result = await window.api.invoke('mcp:rotateToken')
    setMessage(
      result.success
        ? 'Nouveau secret créé : les relais connectés ont été déconnectés et se reconnecteront avec le nouveau.'
        : 'Le secret n’a pas pu être régénéré.'
    )
    await refresh()
  }

  if (status === null) return <p className="p-8 text-center text-sm text-content-muted">Chargement…</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Section
        title="Pont Claude Code"
        description="Claude Code (CLI) lit et dessine la carte par ce pont local : aucun port réseau, un secret propre à ce profil."
      >
        <p className={status.listening ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
          {status.listening
            ? `● Pont actif — ${status.clients} client${status.clients > 1 ? 's' : ''} connecté${status.clients > 1 ? 's' : ''}`
            : '● Pont inactif — redémarre l’app (une autre instance l’utilise peut-être déjà).'}
        </p>
      </Section>

      <Section
        title="Brancher Claude Code"
        description="À faire une fois : lance cette commande dans un terminal. Elle ne contient aucun secret."
      >
        <label htmlFor={commandId} className="sr-only">
          Commande d’enregistrement
        </label>
        <textarea
          id={commandId}
          readOnly
          value={status.command}
          rows={4}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full resize-none rounded-md bg-surface p-3 font-mono text-xs leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => void copy()}>
            Copier la commande
          </Button>
          <p className="text-sm text-content-muted">
            Ensuite, dans n’importe quel terminal Claude Code : « travaillons dans le brainstormer ».
          </p>
        </div>
      </Section>

      <Section
        title="Secret du pont"
        description="À régénérer si tu penses qu’un autre programme a pu le lire. Les relais connectés sont coupés."
      >
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">Régénérer le secret maintenant ?</p>
            <Button variant="danger" onClick={() => void rotate()}>
              Oui, régénérer
            </Button>
            <Button onClick={() => setConfirming(false)}>Annuler</Button>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)}>Régénérer le secret</Button>
        )}
      </Section>

      {message === '' ? null : (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
