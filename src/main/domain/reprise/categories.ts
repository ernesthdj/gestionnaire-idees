import type { CodeCategory } from '@shared/ipc/reprise'

/** Ce que les règles savent d'un élément (spec 017 R3). */
export interface CategoryInput {
  /** Chemin relatif du fichier, `/`. */
  readonly path: string
  readonly kind: 'file' | 'namespace' | 'class' | 'interface' | 'function' | 'method'
  readonly name: string
  readonly bases: readonly string[]
  readonly attributes: readonly string[]
  /** Point d'entrée (route HTTP, programme principal…). */
  readonly entry: boolean
}

export interface CategoryVerdict {
  readonly category: CodeCategory
  /** Raison courte, en français, montrée dans le panneau de l'explorateur. */
  readonly reason: string
}

const PLUMBING_DIRS = /(^|\/)(utils?|helpers?|logging|loggers?|common|shared\/utils?)(\/|$)/i
const PLUMBING_NAMES =
  /^(log|logger|debug|trace|warn|toJson|fromJson|serialize|deserialize|stringify|format\w*|clone|noop)$/i
const PLUMBING_TYPES = /(Logger|Log|Helper|Helpers|Utils?|Extensions|Formatter|Mapper|Serializer)$/

const ORCHESTRATION_DIRS = /(^|\/)(controllers?|routes|middlewares?|handlers?|endpoints|commands|api|http)(\/|$)/i
const ORCHESTRATION_TYPES = /(Controller|Middleware|Handler|Command|Endpoint|Router|Routes|Job|Listener)$/
const ORCHESTRATION_ATTRIBUTES = /^(ApiController|Route|Http(Get|Post|Put|Patch|Delete))$/

const INFRASTRUCTURE_DIRS =
  /(^|\/)(infra|infrastructure|repositories|repository|db|database|persistence|data|migrations|models|clients?|storage)(\/|$)/i
const INFRASTRUCTURE_TYPES = /(Repository|DbContext|Context|Client|Gateway|Store|Cache|Queue|Dao|Migration)$/
const INFRASTRUCTURE_BASES = /^(Model|DbContext|Migration|Seeder|Authenticatable)$/

/**
 * Catégorie proposée par règles (spec 017 R3, FR-015), dans l'ordre : plomberie, orchestration, infrastructure,
 * sinon métier. Un avis de l'IA ou une correction de mentalyas peut la remplacer ensuite. Fonction pure.
 */
export function categorize(input: CategoryInput): CategoryVerdict {
  const { path, name, bases, attributes } = input
  if (PLUMBING_NAMES.test(name) || PLUMBING_TYPES.test(name) || PLUMBING_DIRS.test(path)) {
    return { category: 'plumbing', reason: 'utilitaire générique (journal, conversion, aide)' }
  }
  if (
    input.entry ||
    attributes.some((attribute) => ORCHESTRATION_ATTRIBUTES.test(attribute)) ||
    ORCHESTRATION_TYPES.test(name) ||
    ORCHESTRATION_DIRS.test(path) ||
    /(^|\/)(Program\.cs|main\.\w+|index\.\w+|server\.\w+)$/i.test(path)
  ) {
    return { category: 'orchestration', reason: 'point d’entrée ou aiguillage (route, contrôleur, programme)' }
  }
  if (
    bases.some((base) => INFRASTRUCTURE_BASES.test(base)) ||
    INFRASTRUCTURE_TYPES.test(name) ||
    INFRASTRUCTURE_DIRS.test(path)
  ) {
    return { category: 'infrastructure', reason: 'accès aux données ou au monde extérieur (base, fichiers, réseau)' }
  }
  return { category: 'domain', reason: 'logique propre au projet (règles, calculs, décisions)' }
}

/**
 * Catégorie d'un membre : celle de sa classe, sauf si une règle plus précise le vise lui-même (un `log()` dans un
 * service reste de la plomberie).
 */
export function categorizeMember(member: CategoryInput, owner: CategoryVerdict): CategoryVerdict {
  const own = categorize({ ...member, path: '' })
  if (own.category === 'plumbing' || (own.category === 'orchestration' && owner.category !== 'orchestration'))
    return own
  return owner
}
