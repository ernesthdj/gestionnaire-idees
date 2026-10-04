/**
 * Flux `stream-json` du CLI Claude Code (spec 008 research R1, vérifié sur 2.1.289) → événements de conversation.
 * Fonction pure : une ligne de sortie du CLI en entrée ; `null` pour tout ce que l'app ignore (hooks, réflexion…).
 */

export type QuotaStatus = 'allowed' | 'allowed_warning' | 'rejected'

export type StreamEvent =
  | { readonly kind: 'init'; readonly sessionId: string; readonly model: string; readonly apiKeySource: string }
  | { readonly kind: 'delta'; readonly text: string }
  | { readonly kind: 'tool'; readonly name: string }
  | {
      readonly kind: 'quota'
      readonly status: QuotaStatus
      readonly utilization: number | null
      readonly resetsAt: number | null
      /** Fenêtres de l'abonnement, tous usages confondus : session (5 h) et semaine (7 jours). */
      readonly fiveHour: UsageWindow | null
      readonly sevenDay: UsageWindow | null
    }
  | {
      readonly kind: 'result'
      readonly ok: boolean
      /** Texte complet de la réponse du tour (succès) ou message d'erreur. */
      readonly text: string
      readonly sessionId: string | null
      readonly usage: TurnUsage
    }

/** Part utilisée (0–1) d'une fenêtre de l'abonnement et sa remise à zéro (secondes depuis 1970). */
export interface UsageWindow {
  readonly utilization: number
  readonly resetsAt: number | null
}

export interface TurnUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

export function parseStreamLine(line: string): StreamEvent[] {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return []
  }
  if (!isObject(value)) return []
  switch (value['type']) {
    case 'system': {
      if (value['subtype'] !== 'init') return []
      return [
        {
          kind: 'init',
          sessionId: str(value['session_id']) ?? '',
          model: str(value['model']) ?? '',
          apiKeySource: str(value['apiKeySource']) ?? ''
        }
      ]
    }
    case 'stream_event': {
      const event = value['event']
      if (!isObject(event) || event['type'] !== 'content_block_delta') return []
      const delta = event['delta']
      if (!isObject(delta) || delta['type'] !== 'text_delta') return []
      const text = str(delta['text'])
      return text === null || text === '' ? [] : [{ kind: 'delta', text }]
    }
    case 'assistant': {
      const message = value['message']
      const content = isObject(message) && Array.isArray(message['content']) ? message['content'] : []
      return content.flatMap((block): StreamEvent[] => {
        if (!isObject(block) || block['type'] !== 'tool_use') return []
        const name = str(block['name'])
        return name === null ? [] : [{ kind: 'tool', name }]
      })
    }
    case 'rate_limit_event': {
      const info = value['rate_limit_info']
      if (!isObject(info)) return []
      const status = info['status']
      if (status !== 'allowed' && status !== 'allowed_warning' && status !== 'rejected') return []
      const windows = isObject(info['unifiedWindows']) ? info['unifiedWindows'] : {}
      return [
        {
          kind: 'quota',
          status,
          utilization: num(info['utilization']),
          resetsAt: num(info['resetsAt']),
          fiveHour: windowOf(windows['five_hour']),
          sevenDay: windowOf(windows['seven_day'])
        }
      ]
    }
    case 'result': {
      const ok = value['subtype'] === 'success' && value['is_error'] !== true
      const text = str(value['result']) ?? (ok ? '' : 'La conversation a échoué.')
      const usage = isObject(value['usage']) ? value['usage'] : {}
      return [
        {
          kind: 'result',
          ok,
          text,
          sessionId: str(value['session_id']),
          usage: {
            inputTokens: num(usage['input_tokens']) ?? 0,
            outputTokens: num(usage['output_tokens']) ?? 0,
            cacheReadTokens: num(usage['cache_read_input_tokens']) ?? 0,
            cacheWriteTokens: num(usage['cache_creation_input_tokens']) ?? 0
          }
        }
      ]
    }
    default:
      return []
  }
}

function windowOf(value: unknown): UsageWindow | null {
  if (!isObject(value)) return null
  const utilization = num(value['utilization'])
  return utilization === null ? null : { utilization, resetsAt: num(value['resetsAt']) }
}

/** Libellé lisible d'une action de Claude, affiché en pastille dans le chat. */
export function toolLabel(name: string): string {
  const short = name.startsWith('mcp__brainstormer__') ? name.slice('mcp__brainstormer__'.length) : name
  const labels: Readonly<Record<string, string>> = {
    fiche_ecrire: 'fiche mise à jour',
    maturite_evaluer: 'maturité évaluée',
    neurone_contexte: 'contexte relu',
    etat: 'carte consultée',
    carte_lire: 'carte lue',
    selection_lire: 'sélection lue',
    noeud_lire: 'élément lu',
    dessiner: 'a dessiné sur la carte',
    noeud_modifier: 'élément modifié',
    relier: 'lien créé',
    retirer: 'éléments retirés',
    widget_poser: 'widget posé',
    Read: 'fichier lu',
    Glob: 'fichiers listés',
    Grep: 'recherche dans les fichiers',
    WebSearch: 'recherche web'
  }
  return labels[short] ?? short
}
