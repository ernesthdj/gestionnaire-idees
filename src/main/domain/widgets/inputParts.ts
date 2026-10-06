import { IDEA_PARTS, STEP_PARTS, type InputPart, type InputSourceKind } from '@shared/ipc/widgetIo'

/**
 * Parties transmises par un branchement (spec 015 research R1), lues depuis la base. Les branchements d'idée créés
 * avant la spec 015 parlent l'ancien vocabulaire (moteur retiré par la spec 010) : ils sont convertis ici, à la
 * lecture, sans réécrire la base. Leurs parties changeant, l'empreinte d'autorisation change aussi : mentalyas
 * réautorise une fois.
 */
const LEGACY_IDEA_PARTS: Readonly<Record<string, readonly InputPart[]>> = {
  identity: ['identity', 'sheet'],
  original: ['identity'],
  tree: ['plan'],
  document: ['annexes'],
  answers: []
}

export function normalizeParts(sourceKind: InputSourceKind, stored: unknown): InputPart[] {
  if (!Array.isArray(stored)) return []
  const values = stored.filter((value): value is string => typeof value === 'string')
  if (sourceKind === 'plan_step') return STEP_PARTS.filter((part) => values.includes(part))
  if (sourceKind !== 'idea') return []
  // `identity` existe dans les deux vocabulaires : seul un mot propre à l'ancien (texte d'origine, réponses, arbre,
  // document) signale un branchement d'avant la spec 015 à convertir.
  const legacy = values.some((value) => LEGACY_ONLY.has(value))
  const wanted = new Set<string>(
    legacy ? values.flatMap((value): readonly string[] => LEGACY_IDEA_PARTS[value] ?? []) : values
  )
  return IDEA_PARTS.filter((part) => wanted.has(part))
}

const LEGACY_ONLY = new Set(['original', 'answers', 'tree', 'document'])

/** Parties autorisées pour une nature de source (une partie inconnue est ignorée). */
export function partsFor(sourceKind: InputSourceKind, parts: readonly string[]): InputPart[] {
  if (sourceKind === 'plan_step') return STEP_PARTS.filter((part) => parts.includes(part))
  if (sourceKind === 'idea') return IDEA_PARTS.filter((part) => parts.includes(part))
  return []
}

/** Parties cochées par défaut au branchement : toutes. */
export function defaultParts(sourceKind: InputSourceKind): InputPart[] {
  if (sourceKind === 'plan_step') return [...STEP_PARTS]
  if (sourceKind === 'idea') return [...IDEA_PARTS]
  return []
}
