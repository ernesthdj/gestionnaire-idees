import { useCallback, useEffect, useId, useState } from 'react'
import { CLAUDE_MODELS, type AiConfigView, type AiStatusView, type AiTestView } from '@shared/ipc/ai'
import type { IpcResult } from '@shared/ipc/result'
import { Button } from '../../../components/atoms/Button'
import { Section } from '../../../components/molecules/Section'

const LOCAL_MODEL_SUGGESTIONS = ['qwen3.5:9b', 'llama3.1:8b', 'gemma3:4b']
export const MODEL_LABELS: Readonly<Record<string, string>> = {
  'claude-opus-5-5': 'Opus 5.5 — meilleur raisonnement',
  'claude-sonnet-5-5': 'Sonnet 5.5 — équilibré, plus économe',
  'claude-haiku-4-5': 'Haiku 4.5 — le plus rapide, le plus économe',
  'claude-opus-5': 'Opus 5 — ancienne génération'
}

type ModelField = 'claudeModel' | 'elementModel' | 'widgetModel'
const MODEL_FIELDS: ReadonlyArray<readonly [ModelField, string, string]> = [
  ['claudeModel', 'Genesis (idées, projets)', 'Cadrage, vision : là où la qualité du raisonnement compte le plus.'],
  ['elementModel', 'Éléments de projet', 'Conversations des éléments d’une carte de structure.'],
  ['widgetModel', 'Génération de widgets', 'Code des widgets.']
]

function errorText<T>(result: IpcResult<T>): string | null {
  return result.success ? null : result.error.message
}

/**
 * État d'un moteur (T043) : couleurs des jetons du thème (vert / ambre, contraste AA sur tous les thèmes, Carbone
 * compris — les variantes `dark:` suivent le système, pas le thème choisi) ; la pastille est décorative, le texte porte
 * l'information.
 */
function EngineState({ ok, text }: { readonly ok: boolean; readonly text: string }): React.JSX.Element {
  return (
    <p className={ok ? 'text-pro' : 'text-idea'}>
      <span aria-hidden="true">● </span>
      {text}
    </p>
  )
}

/**
 * Réglages › IA (spec 010) : Claude passe par Claude Code (ton abonnement — aucune clé, aucun budget dans l'app),
 * Ollama traite les tâches locales. Modèle par usage, modifiable aussi conversation par conversation dans le chat.
 */
export function AiSettingsPage(): React.JSX.Element {
  const [status, setStatus] = useState<AiStatusView | null>(null)
  const [config, setConfig] = useState<AiConfigView | null>(null)
  const [localModel, setLocalModel] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const ids = { local: useId(), fallback: useId(), models: useId() }

  const refresh = useCallback(async (): Promise<void> => {
    const [statusResult, configResult] = await Promise.all([
      window.api.invoke<AiStatusView>('ai:status'),
      window.api.invoke<AiConfigView>('ai:getConfig')
    ])
    if (statusResult.success) setStatus(statusResult.data)
    if (configResult.success) {
      setConfig(configResult.data)
      setLocalModel(configResult.data.localModel)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Les contrôles ne sont jamais désactivés pendant un traitement (T043) : un contrôle désactivé perd le focus, qui
  // retomberait en haut de la page au clavier. Une action pendant une autre est simplement ignorée (`aria-disabled`).
  const run = async (action: () => Promise<string>): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      setMessage(await action())
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const saveConfig = (patch: Partial<AiConfigView>, done: string): Promise<void> =>
    run(async () => errorText(await window.api.invoke('ai:setConfig', patch)) ?? done)

  const test = (engine: 'ollama' | 'claude'): Promise<void> =>
    run(async () => {
      const result = await window.api.invoke<AiTestView>('ai:test', { engine })
      if (!result.success) return result.error.message
      const name = engine === 'ollama' ? 'IA locale' : 'Claude Code'
      return result.data.ok ? `${name} est prête.` : `${name} : ${result.data.reason ?? 'échec'}`
    })

  if (status === null || config === null) {
    return (
      <p role="status" className="p-8 text-content-muted">
        Chargement des réglages…
      </p>
    )
  }

  return (
    <div aria-busy={busy} className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Réglages › IA</h1>
        <p className="text-sm text-content-muted">
          Claude travaille par Claude Code, avec ton abonnement : aucune clé API, aucune facture dans l&apos;app.
          L&apos;IA locale (Ollama) traite les petites tâches sur ton PC.
        </p>
      </header>

      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {message}
      </p>

      <Section title="Claude Code" description="Le CLI officiel installé sur ta machine, connecté à ton compte Claude.">
        <EngineState
          ok={status.claude.ready}
          text={
            status.claude.ready
              ? 'Prêt'
              : `Indisponible — ${status.claude.reason ?? 'installe Claude Code puis connecte-toi avec « claude »'}`
          }
        />
        <Button aria-disabled={busy} aria-label="Revérifier Claude Code" onClick={() => void test('claude')}>
          Revérifier
        </Button>
      </Section>

      <Section
        title="Modèles"
        description="Modèle utilisé par défaut selon l’usage ; chaque conversation peut aussi choisir le sien."
      >
        <div id={ids.models} className="space-y-3">
          {MODEL_FIELDS.map(([field, label, help]) => (
            <div key={field} className="flex flex-wrap items-center gap-3">
              <div className="w-56 text-sm">
                <label htmlFor={`${ids.models}-${field}`}>{label}</label>
                <span id={`${ids.models}-${field}-help`} className="block text-xs text-content-muted">
                  {help}
                </span>
              </div>
              <select
                id={`${ids.models}-${field}`}
                aria-describedby={`${ids.models}-${field}-help`}
                value={config[field]}
                aria-disabled={busy}
                onChange={(event) =>
                  void saveConfig(
                    { [field]: event.target.value },
                    `${label} : ${MODEL_LABELS[event.target.value] ?? event.target.value}.`
                  )
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
          ))}
        </div>
      </Section>

      <Section title="IA locale (Ollama)" description={`Modèle : ${status.ollama.model}`}>
        <EngineState
          ok={status.ollama.up}
          text={status.ollama.up ? 'Prête' : `Indisponible — ${status.ollama.reason ?? ''}`}
        />
        {status.ollama.guidance.length > 0 ? (
          <ol aria-label="Pour démarrer l’IA locale" className="list-decimal space-y-1 pl-6 text-sm">
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
          <Button
            aria-disabled={busy}
            aria-label="Enregistrer le modèle local"
            onClick={() => void saveConfig({ localModel }, `Modèle local : ${localModel}.`)}
          >
            Enregistrer
          </Button>
          <Button aria-disabled={busy} aria-label="Revérifier l’IA locale" onClick={() => void test('ollama')}>
            Revérifier
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={ids.fallback}
            type="checkbox"
            checked={config.allowClaudeFallback}
            aria-disabled={busy}
            onChange={(event) =>
              void saveConfig(
                { allowClaudeFallback: event.target.checked },
                event.target.checked ? 'Repli vers Claude autorisé.' : 'Repli vers Claude désactivé.'
              )
            }
            className="size-4"
          />
          <label htmlFor={ids.fallback} className="text-sm">
            Si l&apos;IA locale est arrêtée, utiliser Claude Code à sa place (sur ton abonnement)
          </label>
        </div>
      </Section>
    </div>
  )
}
