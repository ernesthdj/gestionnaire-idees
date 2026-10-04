import { z } from 'zod'

/**
 * Fiche d'un neurone (spec 008 research R5) : résumé vivant tenu par Claude, transmis aux enfants au lot B.
 * Fonctions pures : lecture tolérante, fusion de sections, borne de taille.
 */

export const SHEET_MAX_CHARS = 12_000
const Item = z.string().trim().min(1).max(500)
const Items = z.array(Item).max(30)

export const Sheet = z.object({
  resume: z.string().trim().max(1000).default(''),
  points_cles: Items.default([]),
  decisions: Items.default([]),
  questions_ouvertes: Items.default([]),
  manques: Items.default([])
})
export type Sheet = z.infer<typeof Sheet>

export const SHEET_SECTIONS = ['points_cles', 'decisions', 'questions_ouvertes', 'manques'] as const

export const EMPTY_SHEET: Sheet = { resume: '', points_cles: [], decisions: [], questions_ouvertes: [], manques: [] }

/** Fiche stockée → fiche lisible ; une valeur abîmée donne une fiche vide (jamais d'erreur à l'affichage). */
export function readSheet(json: string | null): Sheet {
  if (json === null) return EMPTY_SHEET
  try {
    const parsed = Sheet.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : EMPTY_SHEET
  } catch {
    return EMPTY_SHEET
  }
}

export type SheetPatch = { readonly [K in keyof Sheet]?: Sheet[K] | undefined }

/** Remplace les sections fournies ; `null` si la fiche dépasserait la borne. */
export function mergeSheet(current: Sheet, patch: SheetPatch): Sheet | null {
  const next: Sheet = {
    resume: patch.resume ?? current.resume,
    points_cles: patch.points_cles ?? current.points_cles,
    decisions: patch.decisions ?? current.decisions,
    questions_ouvertes: patch.questions_ouvertes ?? current.questions_ouvertes,
    manques: patch.manques ?? current.manques
  }
  return JSON.stringify(next).length > SHEET_MAX_CHARS ? null : next
}

export function isEmptySheet(sheet: Sheet): boolean {
  return sheet.resume === '' && SHEET_SECTIONS.every((section) => sheet[section].length === 0)
}

const TITLES: Readonly<Record<(typeof SHEET_SECTIONS)[number], string>> = {
  points_cles: 'Points clés',
  decisions: 'Décisions',
  questions_ouvertes: 'Questions ouvertes',
  manques: 'Manques'
}

/** Fiche en Markdown lisible (contexte joint, export). */
export function sheetMarkdown(sheet: Sheet): string {
  if (isEmptySheet(sheet)) return '(fiche vide : rien n’a encore été établi)'
  const parts = [sheet.resume === '' ? null : `Résumé : ${sheet.resume}`]
  for (const section of SHEET_SECTIONS) {
    if (sheet[section].length > 0)
      parts.push(`${TITLES[section]} :\n${sheet[section].map((item) => `- ${item}`).join('\n')}`)
  }
  return parts.filter((part) => part !== null).join('\n\n')
}
