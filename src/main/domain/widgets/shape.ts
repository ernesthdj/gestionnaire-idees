/**
 * Signature de structure d'une donnée (spec 005, plan § Signature de structure) : noms de champs, types et tailles
 * de listes — JAMAIS une valeur. C'est tout ce que Claude reçoit des entrées et des résultats d'un widget.
 */

const MAX_DEPTH = 8
const MAX_KEYS = 40

function typeOf(value: unknown, depth: number, withSizes: boolean): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (depth >= MAX_DEPTH) return '[…]'
    const kinds = [...new Set(value.map((item) => typeOf(item, depth + 1, withSizes)))]
    const inner = kinds.length === 1 ? (kinds[0] ?? 'unknown') : `(${kinds.sort().join(' | ')})`
    return withSizes ? `[${inner}] × ${value.length}` : `[${inner}]`
  }
  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) return '{…}'
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, MAX_KEYS)
    return `{ ${entries.map(([key, item]) => `${key}: ${typeOf(item, depth + 1, withSizes)}`).join(', ')} }`
  }
  return typeof value
}

/** Structure lisible d'une donnée, tailles de listes comprises (décrite à Claude). */
export function shapeOf(value: unknown): string {
  return typeOf(value, 0, true)
}

/** Structure sans les tailles : deux données de même forme ont la même signature. */
export function shapeSignature(value: unknown): string {
  return typeOf(value, 0, false)
}
