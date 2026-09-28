/**
 * Règles d'anonymisation déterministes (spec 001 research R6) — appliquées à TOUT texte avant envoi externe.
 * Principe : sur-anonymiser est sans risque, sous-anonymiser ne l'est pas.
 */

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/giu
const EMAIL_PATTERN = /[\p{L}\d._%+-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)+/gu
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}(?: ?[A-Z\d]{4}){2,7}(?: ?[A-Z\d]{1,3})?\b/g
const PHONE_PATTERN = /(?:(?:\+|\b00)\d{1,3}(?:[\s./-]?\d){6,12}|\b0\d(?:[\s./-]?\d){7,9})\b/g

// `\s` couvre aussi les espaces insécables (U+00A0, U+202F) utilisées comme séparateur de milliers.
const NUMBER = String.raw`(?:\d{1,3}(?:[\s.]\d{3})+|\d+)(?:[.,]\d{1,2})?(?: ?k)?`
const AMOUNT_PATTERN = new RegExp(String.raw`(?:€|\bEUR)\s?(${NUMBER})|(${NUMBER})\s?(?:€|\beuros?\b|\bEUR\b)`, 'giu')

const STREET_TYPES = [
  'rue',
  'avenue',
  'av.',
  'boulevard',
  'bd',
  'chaussée',
  'place',
  'chemin',
  'allée',
  'impasse',
  'quai',
  'route',
  'square',
  'drève',
  'clos',
  'venelle',
  'sentier',
  'passage'
]
// Seule la première lettre accepte les deux casses (« Rue » / « rue ») : le drapeau `i` rendrait `\p{Lu}`
// inopérant pour reconnaître le nom propre de la voie qui suit.
const STREET_TYPE = STREET_TYPES.map((type) => {
  const first = type.charAt(0)
  return `[${first.toUpperCase()}${first}]${type.slice(1).replace('.', String.raw`\.`)}`
}).join('|')
const PROPER_WORDS = String.raw`\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*)*`
const ADDRESS_PATTERN = new RegExp(
  String.raw`(?:\b\d{1,4}\s?(?:bis|ter)?\s+)?(?<!\p{L})(?:${STREET_TYPE})(?!\p{L})` +
    String.raw`(?:\s+(?:de\s+la|de\s+l['’]|du|des|de|d['’]))?\s*${PROPER_WORDS}(?:\s+\d{1,4}(?:bis|ter)?\b)?`,
  'gu'
)
/** Code postal belge (4 chiffres) ou français (5 chiffres) suivi d'un nom de localité. */
const POSTCODE_PATTERN = new RegExp(String.raw`\b(?:[1-9]\d{3}|\d{5})\s+${PROPER_WORDS}`, 'gu')

/** Convertit un montant écrit à la française (« 1 247,50 », « 1.250 », « 2k ») en nombre. */
export function parseAmount(raw: string): number {
  let text = raw.replace(/\s/g, '').toLowerCase()
  let factor = 1
  if (text.endsWith('k')) {
    factor = 1000
    text = text.slice(0, -1)
  }
  if (text.includes(',')) {
    text = text.replaceAll('.', '').replace(',', '.')
  } else if (/\.\d{3}$/.test(text)) {
    text = text.replaceAll('.', '')
  }
  return Number.parseFloat(text) * factor
}

/** Remplace un montant exact par une fourchette (FR-006). */
export function amountBand(value: number): string {
  if (value < 100) return '<100 €'
  if (value < 500) return '100-500 €'
  if (value < 1000) return '500-1000 €'
  if (value <= 2500) return '1000-2500 €'
  return '>2500 €'
}

export interface RuleOptions {
  /** Montants → fourchettes. Réglage utilisateur (constitution v1.1.0) ; activé si non précisé. */
  readonly maskAmounts?: boolean
}

/** Liens, e-mails, IBAN, téléphones, montants, adresses puis codes postaux — ordre choisi contre les chevauchements. */
export function applyDeterministicRules(text: string, options: RuleOptions = {}): string {
  const identifiers = text
    .replace(URL_PATTERN, '[lien]')
    .replace(EMAIL_PATTERN, '[e-mail]')
    .replace(IBAN_PATTERN, '[IBAN]')
    .replace(PHONE_PATTERN, '[téléphone]')
  const amounts =
    options.maskAmounts === false
      ? identifiers
      : identifiers.replace(AMOUNT_PATTERN, (_match, prefixed: string | undefined, suffixed: string | undefined) => {
          const value = parseAmount(prefixed ?? suffixed ?? '0')
          return Number.isFinite(value) ? `[montant ${amountBand(value)}]` : '[montant]'
        })
  return amounts.replace(ADDRESS_PATTERN, '[adresse]').replace(POSTCODE_PATTERN, '[lieu]')
}

/** Montants en euros écrits dans le texte (même reconnaissance que l'anonymisation), en valeur numérique. */
export function amountsIn(text: string): number[] {
  return [...text.matchAll(AMOUNT_PATTERN)]
    .map((match) => parseAmount(match[1] ?? match[2] ?? ''))
    .filter((value) => Number.isFinite(value))
}

/** Tous les nombres écrits dans le texte, avec ou sans devise (« 250 », « 1 200,50 », « 2k »). */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(new RegExp(String.raw`(?<![\d.,])${NUMBER}(?![\d\p{L}])`, 'giu'))]
    .map((match) => parseAmount(match[0]))
    .filter((value) => Number.isFinite(value))
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Terme détecté par l'IA locale, associé à son remplaçant. */
export interface SensitiveTerm {
  readonly term: string
  readonly placeholder: string
}

/** Remplace des mots entiers, du plus long au plus court (« Citadelle de Namur » avant « Namur »). */
export function replaceTerms(text: string, terms: readonly SensitiveTerm[]): string {
  const unique = new Map<string, string>()
  for (const { term, placeholder } of terms) {
    const trimmed = term.trim()
    if (trimmed.length >= 2 && !unique.has(trimmed)) unique.set(trimmed, placeholder)
  }
  let result = text
  for (const [term, placeholder] of [...unique].sort(([a], [b]) => b.length - a.length)) {
    result = result.replace(new RegExp(`(?<![\\p{L}\\d])${escapeRegExp(term)}(?![\\p{L}\\d])`, 'gu'), placeholder)
  }
  return result
}

/** Remplace chaque nom de personne détecté par « [personne] ». */
export function replacePersons(text: string, persons: readonly string[]): string {
  return replaceTerms(
    text,
    persons.map((term) => ({ term, placeholder: '[personne]' }))
  )
}

/** Remplace chaque lieu détecté (ville, quartier, établissement) par « [lieu] ». */
export function replacePlaces(text: string, places: readonly string[]): string {
  return replaceTerms(
    text,
    places.map((term) => ({ term, placeholder: '[lieu]' }))
  )
}

/** Mots capitalisés fréquents qui ne sont pas des noms de personnes (début de phrase, noms communs). */
const COMMON_CAPITALIZED = new Set(
  (
    'le la les un une des du de au aux ce cet cette ces mon ma mes ton ta tes son sa ses notre votre leur leurs ' +
    'je tu il elle on nous vous ils elles me moi toi lui eux y en et ou mais donc or ni car si quand comme ' +
    'pour par avec sans sous sur dans chez vers avant après depuis pendant entre contre selon ' +
    'quel quelle quels quelles qui que quoi dont où comment pourquoi combien est-ce faut-il ' +
    'acheter payer envoyer appeler rappeler rembourser réserver trouver penser prendre faire aller venir voir ' +
    'demander écrire lire choisir organiser préparer créer lancer tester monter mettre migrer configurer ' +
    'commander remplacer vendre regarder chercher noter finir commencer apprendre réunion virement idée ' +
    'projet budget achat sortie photo client facture devis mission shooting mariage rendez-vous ' +
    'lundi mardi mercredi jeudi vendredi samedi dimanche janvier février mars avril mai juin juillet août ' +
    'septembre octobre novembre décembre oui non ok merci bonjour salut ' +
    'ne pas plus très bien aussi encore déjà toujours jamais peut-être ici là'
  )
    .split(' ')
    .map((word) => word.toLowerCase())
)

const CAPITALIZED_WORD = /(?<![\p{L}\d[])\p{Lu}[\p{L}'’-]*/gu

/** Repli sans IA : masque tout mot capitalisé qui n'est ni courant ni un sigle court (PC, NAS, IT). */
export function maskCapitalizedWords(text: string): string {
  return text.replace(CAPITALIZED_WORD, (word) => {
    const isShortAcronym = word.length <= 5 && word === word.toUpperCase()
    const bare = word.toLowerCase().replace(/['’].*$/u, '')
    return isShortAcronym || COMMON_CAPITALIZED.has(word.toLowerCase()) || COMMON_CAPITALIZED.has(bare) ? word : '[nom]'
  })
}
