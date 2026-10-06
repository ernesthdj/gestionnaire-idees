import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useState } from 'react'
import type { AppSettingsView } from '@shared/ipc/app'
import { DEFAULT_PERMISSION_MODES, type DefaultPermissionMode } from '@shared/ipc/chat'
import type { McpStatusView } from '@shared/ipc/mcp'
import { APP_SETTINGS_KEY, useEffectiveSettings } from '../../../app/useAppSettings'
import { MODE_LABELS } from '../../../chat/ChatPanel'
import { Button } from '../../../components/atoms/Button'
import { Section } from '../../../components/molecules/Section'
import { call, IpcFailure } from '../../../lib/ipc'

const MODE_HINTS: Readonly<Record<DefaultPermissionMode, string>> = {
  default: 'chaque écriture et chaque commande attend ton accord dans le chat',
  acceptEdits: 'les écritures se font sans demande, les commandes attendent ton accord'
}

/**
 * Mode de permission des nouvelles conversations (spec 014 US2, D8) : Demander ou Accepter les modifications ; Libre
 * se choisit conversation par conversation, après avertissement.
 */
function DefaultModeSetting({ onMessage }: { readonly onMessage: (text: string) => void }): React.JSX.Element {
  const client = useQueryClient()
  const current = useEffectiveSettings().chatPermissionMode
  const name = useId()

  const choose = async (mode: DefaultPermissionMode): Promise<void> => {
    if (mode === current) return
    try {
      client.setQueryData(
        APP_SETTINGS_KEY,
        await call<AppSettingsView>('app:setSettings', { chatPermissionMode: mode })
      )
      onMessage(`Les nouvelles conversations démarreront en « ${MODE_LABELS[mode]} ».`)
    } catch (error) {
      onMessage(error instanceof IpcFailure ? error.message : 'Le mode par défaut n’a pas pu être enregistré.')
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Mode des nouvelles conversations</legend>
      {DEFAULT_PERMISSION_MODES.map((mode) => (
        <label key={mode} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={mode}
            checked={current === mode}
            onChange={() => void choose(mode)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{MODE_LABELS[mode]}</span>
            <span className="text-content-muted"> — {MODE_HINTS[mode]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

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
        title="Mode des nouvelles conversations"
        description="Ce que Claude peut faire sans te demander quand une conversation commence. Chaque conversation peut ensuite changer de mode depuis son en-tête ; « Libre » se choisit là, après un avertissement."
      >
        <DefaultModeSetting onMessage={setMessage} />
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
