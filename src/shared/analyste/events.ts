import { z } from 'zod'

/**
 * Catalogue fermé des événements de la sonde (spec 019 FR-004, FR-005). Aucun champ libre : chaque événement a son
 * schéma, chaque chaîne est une énumération ou un format strict et court. Jamais de texte saisi, de titre, de message
 * d'erreur ni de chemin hors du dépôt. La famille « IA » n'est pas ici : elle est lue dans `ai_calls`.
 */

export const PROBE_FAMILIES = ['navigation', 'action', 'erreur', 'performance'] as const
export type ProbeFamily = (typeof PROBE_FAMILIES)[number]

export const PROBE_SCREENS = [
  'carte',
  'a_valider',
  'historique',
  'reglages',
  'chat',
  'explorateur',
  'analyste',
  'skills',
  'accueil'
] as const
export type ProbeScreen = (typeof PROBE_SCREENS)[number]

export const PROBE_SUBJECT_KINDS = ['neuron', 'link', 'block', 'conversation', 'step', 'batch'] as const
export type ProbeSubjectKind = (typeof PROBE_SUBJECT_KINDS)[number]

export const PROBE_VIA = ['souris', 'clavier', 'menu', 'mcp'] as const
export type ProbeVia = (typeof PROBE_VIA)[number]

/** Actions de mentalyas observées (l'objet est désigné par son type, jamais par son texte). */
export const PROBE_ACTIONS = [
  'neuron.create',
  'neuron.remove',
  'link.create',
  'block.create',
  'history.undo',
  'chat.send',
  'plan.decide'
] as const
export type ProbeAction = (typeof PROBE_ACTIONS)[number]

export const PROBE_STATUSES = ['ok', 'error', 'cancelled'] as const
export type ProbeStatus = (typeof PROBE_STATUSES)[number]

export const PROBE_LIMITS = {
  /** Événements par lot envoyé par l'interface. */
  batch: 100,
  /** Emplacements de code gardés pour une erreur. */
  frames: 5,
  /** Longueur maximale d'un nom de code, de module ou de canal. */
  token: 48,
  /** Identifiant d'objet reçu (jamais stocké : le main le remplace par un pseudonyme). */
  subjectId: 64
} as const

/** Nom d'erreur ou code métier : un identifiant, jamais une phrase. */
export const ProbeCode = z.string().regex(/^[A-Za-z][A-Za-z0-9_.]{0,47}$/)

/** Emplacement de code « chemin/relatif.ts:123 » : relatif au dépôt, sans remontée ni lecteur. */
export const ProbeFrame = z
  .string()
  .max(200)
  .regex(/^(?!\/)(?![A-Za-z]:)(?!.*\.\.)[A-Za-z0-9_./-]+\.[A-Za-z0-9]+:\d{1,6}$/)

const Duration = z.int().min(0).max(86_400_000)

/** Événements que l'interface peut envoyer (canal `analyste:events`). */
export const RendererProbeEvent = z.discriminatedUnion('event', [
  z.object({ event: z.literal('screen.open'), screen: z.enum(PROBE_SCREENS) }).strict(),
  z.object({ event: z.literal('panel.close'), screen: z.enum(PROBE_SCREENS), durationMs: Duration }).strict(),
  ...PROBE_ACTIONS.map((name) =>
    z
      .object({
        event: z.literal(name),
        subjectKind: z.enum(PROBE_SUBJECT_KINDS),
        subjectId: z.string().min(1).max(PROBE_LIMITS.subjectId).optional(),
        via: z.enum(PROBE_VIA)
      })
      .strict()
  ),
  z
    .object({
      event: z.literal('error.renderer'),
      code: ProbeCode,
      frames: z.array(ProbeFrame).max(PROBE_LIMITS.frames)
    })
    .strict()
])
export type RendererProbeEvent = z.infer<typeof RendererProbeEvent>

export const ProbeEventBatch = z.object({ events: z.array(z.unknown()).max(PROBE_LIMITS.batch) }).strict()

/** Observation telle qu'elle est enregistrée (data-model `observations`), sans identifiant brut. */
export interface ObservationRecord {
  readonly at: number
  readonly family: ProbeFamily
  readonly event: string
  readonly screen?: ProbeScreen
  readonly subjectKind?: ProbeSubjectKind
  readonly subjectRef?: string
  readonly via?: ProbeVia
  readonly channel?: string
  readonly code?: string
  readonly module?: string
  readonly frames?: readonly string[]
  readonly durationMs?: number
  readonly status?: ProbeStatus
  readonly count?: number
}

/** Famille d'un événement de l'interface. */
export function familyOf(event: RendererProbeEvent['event']): ProbeFamily {
  if (event === 'screen.open' || event === 'panel.close') return 'navigation'
  if (event === 'error.renderer') return 'erreur'
  return 'action'
}
