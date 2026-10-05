import './aiThinking.css'
import type { AiWorker } from './useWidget'

/** « claude-opus-5-5 » → « Claude Opus 5.5 » ; un modèle local garde son nom Ollama (« Ollama · qwen3.5:9b »). */
export function workerLabel(worker: AiWorker): string {
  if (worker.engine === 'ollama') return worker.model === '' ? 'Ollama' : `Ollama · ${worker.model}`
  const match = /^claude-([a-z]+)-(\d+(?:-\d+)*)/.exec(worker.model)
  if (match === null) return worker.model === '' ? 'Claude' : `Claude · ${worker.model}`
  const [, family = '', version = ''] = match
  return `Claude ${family.charAt(0).toUpperCase()}${family.slice(1)} ${version.replaceAll('-', '.')}`
}

interface AiThinkingProps {
  readonly thinking: boolean
  readonly worker: AiWorker | null
}

/**
 * Indicateur « l'IA réfléchit » : trois neurones qui s'allument l'un après l'autre, et l'étiquette du moteur qui
 * travaille réellement (repli compris). Animation coupée par le réglage « réduire les animations ».
 */
export function AiThinking({ thinking, worker }: AiThinkingProps): React.JSX.Element {
  const label = worker === null ? null : workerLabel(worker)
  return (
    <div role="status" aria-live="polite" className="flex min-h-6 items-center gap-2 text-xs text-content-muted">
      {thinking ? (
        <>
          <svg className="ai-thinking" width="40" height="16" viewBox="0 0 40 16" aria-hidden="true">
            <path className="ai-thinking-synapse" d="M4 8 Q12 1 20 8 T36 8" />
            <circle className="ai-thinking-neuron" cx="4" cy="8" r="3" />
            <circle className="ai-thinking-neuron" cx="20" cy="8" r="3" />
            <circle className="ai-thinking-neuron" cx="36" cy="8" r="3" />
          </svg>
          <span>L’IA réfléchit…</span>
          {label === null ? null : (
            <span className="ai-engine" data-engine={worker?.engine}>
              {label}
            </span>
          )}
        </>
      ) : null}
    </div>
  )
}
