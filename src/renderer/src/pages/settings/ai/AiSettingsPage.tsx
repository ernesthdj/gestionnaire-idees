import { useCallback, useEffect, useId, useState } from 'react'
import { CLAUDE_MODELS, type AiConfigView, type AiStatusView, type AiTestView } from '@shared/ipc/ai'
import type { IpcResult } from '@shared/ipc/result'
import { Button } from '../../../components/atoms/Button'
import { Section } from '../../../components/molecules/Section'
import { budgetPercent, formatEuros, parseEurosToCents } from './format'

const LOCAL_MODEL_SUGGESTIONS = ['qwen3.5:9b', 'llama3.1:8b', 'gemma3:4b']
const MODEL_LABELS: Record<string, string> = {
  'claude-opus-5': 'Claude Opus 5 — meilleur raisonnement',
  'claude-sonnet-5': 'Claude Sonnet 5 — plus économique',
  'claude-haiku-4-5': 'Claude Haiku 4.5 — le plus rapide'
}

function errorText<T>(result: IpcResult<T>): string | null {
  return result.success ? null : result.error.message
}

/** Écran Réglages › IA (spec 001 US4) : moteurs, clé Claude, modèles et budget. */
export function AiSettingsPage(): React.JSX.Element {
  const [status, setStatus] = useState<AiStatusView | null>(null)
  const [config, setConfig] = useState<AiConfigView | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [capInput, setCapInput] = useState('')
  const [localModel, setLocalModel] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [tests, setTests] = useState<Partial<Record<'ollama' | 'claude', AiTestView>>>({})
  const [confirmUnlock, setConfirmUnlock] = useState(false)
  const ids = {
    key: useId(),
    cap: useId(),
    model: useId(),
    local: useId(),
    fallback: useId(),
    masking: useId(),
    unlock: useId()
  }

  const refresh = useCallback(async (): Promise<void> => {
    const [statusResult, configResult] = await Promise.all([
      window.api.invoke<AiStatusView>('ai:status'),
      window.api.invoke<AiConfigView>('ai:getConfig')
    ])
    if (statusResult.success) setStatus(statusResult.data)
    if (configResult.success) {
      setConfig(configResult.data)
      setCapInput(String(configResult.data.capCents / 100).replace('.', ','))
      setLocalModel(configResult.data.localModel)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return window.api.on('ai:budgetAlert', () => void refresh())
  }, [refresh])

  const run = async (action: () => Promise<string>): Promise<void> => {
    setBusy(true)
    try {
      setMessage(await action())
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const saveKey = (): Promise<void> =>
    run(async () => {
      const result = await window.api.invoke<{ masked: string }>('ai:setClaudeKey', { key: keyInput })
      setKeyInput('')
      return result.success
        ? `Clé enregistrée (${result.data.masked}).`
        : 'Clé invalide : elle doit commencer par « sk-ant- ».'
    })

  const clearKey = (): Promise<void> =>
    run(async () => errorText(await window.api.invoke('ai:clearClaudeKey')) ?? 'Clé effacée.')

  const saveConfig = (patch: Partial<AiConfigView>, done: string): Promise<void> =>
    run(async () => errorText(await window.api.invoke('ai:setConfig', patch)) ?? done)

  const saveCap = (): Promise<void> => {
    const cents = parseEurosToCents(capInput)
    if (cents === null) {
      setMessage('Plafond invalide : indique un montant entre 0 et 1 000 €.')
      return Promise.resolve()
    }
    return saveConfig({ capCents: cents }, `Plafond fixé à ${formatEuros(cents)} par mois.`)
  }

  const test = (engine: 'ollama' | 'claude'): Promise<void> =>
    run(async () => {
      const result = await window.api.invoke<AiTestView>('ai:test', { engine })
      if (!result.success) return result.error.message
      setTests((previous) => ({ ...previous, [engine]: result.data }))
      const name = engine === 'ollama' ? 'IA locale' : 'Claude'
      return result.data.ok
        ? `${name} répond (${result.data.latencyMs ?? 0} ms).`
        : `${name} : ${result.data.reason ?? 'échec'}`
    })

  const unlock = (): Promise<void> =>
    run(
      async () =>
        errorText(await window.api.invoke('ai:unlockBudget', { confirm: true })) ?? 'Budget débloqué pour ce mois.'
    )

  if (status === null || config === null) {
    return (
      <p role="status" className="p-8 text-content-muted">
        Chargement des réglages…
      </p>
    )
  }

  const percent = budgetPercent(status.budget.spentCents, status.budget.capCents)
  const barColor =
    status.budget.state === 'blocked' ? 'bg-red-500' : status.budget.state === 'alert' ? 'bg-amber-500' : 'bg-accent'

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Réglages › IA</h1>
        <p className="text-sm text-content-muted">
          L&apos;IA locale traite les petites tâches sur ton PC ; Claude est sollicité pour le raisonnement profond,
          après anonymisation.
        </p>
      </header>

      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {message}
      </p>

      <Section title="IA locale (Ollama)" description={`Modèle : ${status.ollama.model}`}>
        <p className={status.ollama.up ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
          {status.ollama.up ? '● Prête' : `● Indisponible — ${status.ollama.reason ?? ''}`}
        </p>
        {status.ollama.guidance.length > 0 ? (
          <ol className="list-decimal space-y-1 pl-6 text-sm">
            {status.ollama.guidance.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.local} className="text-sm">
              Modèle local
            </label>
            <input
              id={ids.local}
              list={`${ids.local}-suggestions`}
              value={localModel}
              onChange={(event) => setLocalModel(event.target.value)}
              className="h-8 w-56 rounded-md border border-content-muted/40 bg-surface px-2 text-sm"
            />
            <datalist id={`${ids.local}-suggestions`}>
              {LOCAL_MODEL_SUGGESTIONS.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>
          <Button disabled={busy} onClick={() => void saveConfig({ localModel }, `Modèle local : ${localModel}.`)}>
            Enregistrer
          </Button>
          <Button disabled={busy} onClick={() => void test('ollama')}>
            Revérifier
          </Button>
        </div>
      </Section>

      <Section title="Claude" description="La clé est chiffrée par Windows et n'est jamais réaffichée en clair.">
        <p className="text-sm">
          {status.claude.configured ? `Clé configurée : ${status.claude.maskedKey ?? ''}` : 'Aucune clé configurée.'}
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void saveKey()
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.key} className="text-sm">
              Clé API Claude
            </label>
            <input
              id={ids.key}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="sk-ant-…"
              className="h-8 w-80 rounded-md border border-content-muted/40 bg-surface px-2 text-sm"
            />
          </div>
          <Button type="submit" variant="primary" disabled={busy || keyInput.trim() === ''}>
            Enregistrer la clé
          </Button>
          {status.claude.configured ? (
            <Button variant="danger" disabled={busy} onClick={() => void clearKey()}>
              Effacer
            </Button>
          ) : null}
          <Button disabled={busy || !status.claude.configured} onClick={() => void test('claude')}>
            Tester la connexion
          </Button>
        </form>
        {tests.claude?.ok === false ? (
          <p className="text-sm text-red-600 dark:text-red-400">{tests.claude.reason}</p>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.model} className="text-sm">
              Modèle Claude
            </label>
            <select
              id={ids.model}
              value={config.claudeModel}
              disabled={busy}
              onChange={(event) =>
                void saveConfig({ claudeModel: event.target.value }, `Modèle Claude : ${event.target.value}.`)
              }
              className="h-8 w-80 rounded-md border border-content-muted/40 bg-surface px-2 text-sm"
            >
              {CLAUDE_MODELS.map((model) => (
                <option key={model} value={model}>
                  {MODEL_LABELS[model] ?? model}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={ids.fallback}
            type="checkbox"
            checked={config.allowClaudeFallback}
            disabled={busy}
            onChange={(event) =>
              void saveConfig(
                { allowClaudeFallback: event.target.checked },
                event.target.checked ? 'Repli vers Claude autorisé.' : 'Repli vers Claude désactivé.'
              )
            }
            className="size-4"
          />
          <label htmlFor={ids.fallback} className="text-sm">
            Si l&apos;IA locale est arrêtée, utiliser Claude à sa place (données anonymisées, coût facturé)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={ids.masking}
            type="checkbox"
            checked={config.maskAmounts}
            disabled={busy}
            onChange={(event) =>
              void saveConfig(
                { maskAmounts: event.target.checked },
                event.target.checked
                  ? 'Montants masqués : Claude ne verra que des fourchettes.'
                  : 'Montants exacts transmis à Claude.'
              )
            }
            className="size-4"
          />
          <label htmlFor={ids.masking} className="text-sm">
            Masquer les montants envoyés à Claude (fourchettes au lieu des valeurs exactes, calculs impossibles)
          </label>
        </div>
      </Section>

      <Section title="Budget mensuel" description="Dépense Claude du mois en cours. Alerte à 80 %, blocage au plafond.">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>
              {formatEuros(status.budget.spentCents)} / {formatEuros(status.budget.capCents)}
            </span>
            <span>{percent} %</span>
          </div>
          <div
            role="progressbar"
            aria-label="Budget IA consommé ce mois"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 w-full overflow-hidden rounded-full bg-surface"
          >
            <div className={`h-full ${barColor} transition-[width] duration-250`} style={{ width: `${percent}%` }} />
          </div>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void saveCap()
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.cap} className="text-sm">
              Plafond mensuel (€)
            </label>
            <input
              id={ids.cap}
              inputMode="decimal"
              value={capInput}
              onChange={(event) => setCapInput(event.target.value)}
              className="h-8 w-32 rounded-md border border-content-muted/40 bg-surface px-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={busy}>
            Enregistrer
          </Button>
        </form>
        {status.budget.state === 'blocked' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={ids.unlock}
              type="checkbox"
              checked={confirmUnlock}
              onChange={(event) => setConfirmUnlock(event.target.checked)}
              className="size-4"
            />
            <label htmlFor={ids.unlock} className="text-sm">
              Je comprends que Claude sera facturé au-delà du plafond ce mois-ci
            </label>
            <Button variant="danger" disabled={busy || !confirmUnlock} onClick={() => void unlock()}>
              Débloquer ce mois
            </Button>
          </div>
        ) : null}
      </Section>
    </main>
  )
}
