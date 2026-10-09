/** Bornes d'un résultat émis par un widget (spec 005 FR-005) : JSON seul, taille, profondeur, clés et chaînes. */
export const RESULT_LIMITS = {
  maxBytes: 200 * 1024,
  maxDepth: 8,
  maxKeyChars: 100,
  maxStringChars: 20_000
} as const

export type ResultCheck = { readonly ok: true; readonly json: string } | { readonly ok: false; readonly reason: string }

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Première raison de refus d'une valeur, ou `null` si elle est acceptable. `depth` : conteneurs déjà traversés. */
function refusal(value: unknown, depth: number): string | null {
  if (value === null || typeof value === 'boolean') return null
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'un nombre n’est pas fini (NaN ou infini)'
  if (typeof value === 'string') {
    return value.length <= RESULT_LIMITS.maxStringChars
      ? null
      : `un texte dépasse ${RESULT_LIMITS.maxStringChars} caractères`
  }
  if (typeof value !== 'object') return 'seul du JSON est accepté (objets, listes, textes, nombres, booléens, null)'
  if (depth >= RESULT_LIMITS.maxDepth) return `plus de ${RESULT_LIMITS.maxDepth} niveaux imbriqués`
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = refusal(item, depth + 1)
      if (reason !== null) return reason
    }
    return null
  }
  if (!isPlainObject(value)) return 'seul du JSON est accepté (objets, listes, textes, nombres, booléens, null)'
  for (const [key, item] of Object.entries(value)) {
    if (key.length > RESULT_LIMITS.maxKeyChars) return `un nom de champ dépasse ${RESULT_LIMITS.maxKeyChars} caractères`
    const reason = refusal(item, depth + 1)
    if (reason !== null) return reason
  }
  return null
}

/** Taille maximale de l'état enregistré par un widget (spec 026 D5) ; les autres bornes sont celles du résultat. */
export const STATE_MAX_BYTES = 64 * 1024

function check(data: unknown, maxBytes: number, refused: string): ResultCheck {
  if (data === undefined) return { ok: false, reason: `${refused} : aucune donnée.` }
  const reason = refusal(data, 0)
  if (reason !== null) return { ok: false, reason: `${refused} : ${reason}.` }
  const json = JSON.stringify(data)
  if (new TextEncoder().encode(json).length > maxBytes) {
    return { ok: false, reason: `${refused} : il dépasse ${maxBytes / 1024} Ko.` }
  }
  return { ok: true, json }
}

/** Vérifie un résultat et le sérialise ; la borne de profondeur arrête aussi une structure qui se contient. */
export function checkResult(data: unknown): ResultCheck {
  return check(data, RESULT_LIMITS.maxBytes, 'Résultat refusé')
}

/** Vérifie l'état d'un widget (spec 026) : mêmes règles que le résultat, 64 Ko au plus. */
export function checkState(data: unknown): ResultCheck {
  return check(data, STATE_MAX_BYTES, 'État refusé')
}
