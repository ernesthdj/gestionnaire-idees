import { z } from 'zod'

/**
 * Panneau de réglages d'un widget (spec 026 D7) : le widget DÉCLARE ses réglages, l'application dessine le panneau.
 * Tout ce qui vient du widget est une donnée bornée, affichée comme du texte ; les valeurs sont toujours ramenées à la
 * déclaration (type, options, bornes), jamais prises telles quelles.
 */
export const SETTING_TYPES = ['text', 'textarea', 'select', 'toggle', 'color', 'range'] as const
export type SettingType = (typeof SETTING_TYPES)[number]

export const SETTINGS_MAX_FIELDS = 40
export const SETTING_TEXT_MAX_CHARS = 2000
const LABEL = z.string().trim().min(1).max(60)
const HEX = /^#[0-9a-f]{6}$/i

const Base = {
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/),
  label: LABEL,
  group: LABEL.optional(),
  help: z.string().trim().max(160).optional()
}

export const SettingField = z.discriminatedUnion('type', [
  z.object({ ...Base, type: z.literal('text'), default: z.string().max(SETTING_TEXT_MAX_CHARS).default('') }).strict(),
  z
    .object({ ...Base, type: z.literal('textarea'), default: z.string().max(SETTING_TEXT_MAX_CHARS).default('') })
    .strict(),
  z
    .object({
      ...Base,
      type: z.literal('select'),
      options: z.array(LABEL).min(1).max(20),
      default: LABEL.optional()
    })
    .strict(),
  z.object({ ...Base, type: z.literal('toggle'), default: z.boolean().default(false) }).strict(),
  z.object({ ...Base, type: z.literal('color'), default: z.string().regex(HEX).default('#2563eb') }).strict(),
  z
    .object({
      ...Base,
      type: z.literal('range'),
      min: z.number().finite(),
      max: z.number().finite(),
      step: z.number().finite().positive().optional(),
      default: z.number().finite().optional()
    })
    .strict()
    .refine((field) => field.min < field.max, { message: 'min doit être inférieur à max' })
])
export type SettingField = z.infer<typeof SettingField>

export const SettingsDeclaration = z
  .array(SettingField)
  .min(1)
  .max(SETTINGS_MAX_FIELDS)
  .refine((fields) => new Set(fields.map((field) => field.key)).size === fields.length, {
    message: 'deux réglages ont la même clé'
  })

export type SettingValue = string | number | boolean
export type SettingValues = Readonly<Record<string, SettingValue>>

function defaultOf(field: SettingField): SettingValue {
  switch (field.type) {
    case 'select':
      return field.default !== undefined && field.options.includes(field.default)
        ? field.default
        : (field.options[0] ?? '')
    case 'range':
      return field.default === undefined ? field.min : Math.min(field.max, Math.max(field.min, field.default))
    default:
      return field.default
  }
}

/** Valeur ramenée à son réglage ; la valeur par défaut si elle ne convient pas. */
function valueOf(field: SettingField, value: unknown): SettingValue {
  switch (field.type) {
    case 'text':
    case 'textarea':
      return typeof value === 'string' ? value.slice(0, SETTING_TEXT_MAX_CHARS) : defaultOf(field)
    case 'select':
      return typeof value === 'string' && field.options.includes(value) ? value : defaultOf(field)
    case 'toggle':
      return typeof value === 'boolean' ? value : defaultOf(field)
    case 'color':
      return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : defaultOf(field)
    case 'range':
      return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(field.max, Math.max(field.min, value))
        : defaultOf(field)
  }
}

/** Valeurs complètes d'une déclaration : une par réglage, et rien d'autre. Pur. */
export function settingValues(fields: readonly SettingField[], values: unknown): SettingValues {
  const given = values !== null && typeof values === 'object' && !Array.isArray(values) ? values : {}
  return Object.fromEntries(
    fields.map((field) => [field.key, valueOf(field, (given as Record<string, unknown>)[field.key])])
  )
}

/** Ce qu'affiche le panneau de réglages d'un widget (spec 026 D7). */
export interface WidgetSettingsView {
  readonly blockId: string
  readonly widgetBlockId: string
  readonly widgetTitle: string | null
  readonly fields: readonly SettingField[]
  readonly values: SettingValues
}

/** Valeurs d'un widget et sa déclaration (vide s'il n'a rien déclaré). */
export interface WidgetSettingValuesView {
  readonly values: SettingValues | null
  readonly fields: readonly SettingField[]
}

/** Réponse à une déclaration : valeurs à remettre au widget, panneau créé ou retrouvé. */
export interface SettingsDeclaredView {
  readonly fields: readonly SettingField[]
  readonly values: SettingValues
  readonly panelBlockId: string
  readonly created: boolean
}
