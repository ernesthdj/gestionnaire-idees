import { amountsIn, numbersIn } from '../ai/anonymizationRules'

/**
 * Valeurs réellement écrites par l'utilisateur (contrôle de provenance P6, spec 002) :
 * un montant ou une date du plan n'est gardé que s'il figure ici.
 */
export interface UserValues {
  /** Montants en centimes : nombres avec ou sans devise. */
  readonly amountsCents: ReadonlySet<number>
  /** Montants explicitement en euros (« 250 € »), seuls utilisés pour restaurer une valeur masquée. */
  readonly euroAmountsCents: ReadonlySet<number>
  /** Dates complètes AAAA-MM-JJ. */
  readonly dates: ReadonlySet<string>
  /** Jours sans année (MM-JJ) : « le 12 mars » vaut pour n'importe quelle année. */
  readonly monthDays: ReadonlySet<string>
}

const MONTHS: Readonly<Record<string, number>> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12
}

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g
const NUMERIC_DATE = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?\b/g
const WRITTEN_DATE =
  /\b(1er|\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?\b/g

const pad = (value: number): string => String(value).padStart(2, '0')
const toCents = (value: number): number => Math.round(value * 100)

function withoutAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function addDate(
  target: { dates: Set<string>; monthDays: Set<string> },
  day: number,
  month: number,
  year?: number
): void {
  if (day < 1 || day > 31 || month < 1 || month > 12) return
  const monthDay = `${pad(month)}-${pad(day)}`
  if (year === undefined) target.monthDays.add(monthDay)
  else target.dates.add(`${year}-${monthDay}`)
}

export function extractValues(texts: readonly string[]): UserValues {
  const amountsCents = new Set<number>()
  const euroAmountsCents = new Set<number>()
  const found = { dates: new Set<string>(), monthDays: new Set<string>() }

  for (const raw of texts) {
    for (const value of numbersIn(raw)) amountsCents.add(toCents(value))
    for (const value of amountsIn(raw)) {
      amountsCents.add(toCents(value))
      euroAmountsCents.add(toCents(value))
    }
    const text = withoutAccents(raw)
    for (const [, year, month, day] of text.matchAll(ISO_DATE)) {
      addDate(found, Number(day), Number(month), Number(year))
    }
    for (const [, day, month, year] of text.replace(ISO_DATE, ' ').matchAll(NUMERIC_DATE)) {
      const fullYear = year === undefined ? undefined : year.length === 2 ? 2000 + Number(year) : Number(year)
      addDate(found, Number(day), Number(month), fullYear)
    }
    for (const [, day, month, year] of text.matchAll(WRITTEN_DATE)) {
      addDate(
        found,
        day === '1er' ? 1 : Number(day),
        MONTHS[month ?? ''] ?? 0,
        year === undefined ? undefined : Number(year)
      )
    }
  }
  return { amountsCents, euroAmountsCents, dates: found.dates, monthDays: found.monthDays }
}

/** Une date du plan est d'origine utilisateur si elle a été écrite, avec ou sans année. */
export function isUserDate(date: string, values: UserValues): boolean {
  return values.dates.has(date) || values.monthDays.has(date.slice(5))
}
