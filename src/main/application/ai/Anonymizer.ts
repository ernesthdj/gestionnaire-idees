import { PersonsOut } from '@shared/ai/schemas'
import { applyDeterministicRules, maskCapitalizedWords, replacePersons } from '../../domain/ai/anonymizationRules'
import type { AIGateway } from './AIGateway'
import type { Anonymizer as AnonymizerPort } from './ports'

/** Renvoie les noms de personnes présents dans le texte, ou `null` si la détection est indisponible. */
export type PersonDetector = (text: string) => Promise<readonly string[] | null>

/**
 * Anonymisation en deux couches (research R6) :
 * 1. règles déterministes (liens, e-mails, IBAN, téléphones, montants → fourchettes), toujours ;
 * 2. noms de personnes détectés par l'IA locale, sinon repli heuristique sur les mots capitalisés.
 * Le texte brut n'est jamais transmis : l'IA locale ne voit que le texte déjà passé par la couche 1.
 */
export class Anonymizer implements AnonymizerPort {
  constructor(private readonly deps: { readonly detectPersons: PersonDetector }) {}

  async anonymize(text: string): Promise<string> {
    const ruled = applyDeterministicRules(text)
    let persons: readonly string[] | null
    try {
      persons = await this.deps.detectPersons(ruled)
    } catch {
      persons = null
    }
    if (persons === null) return maskCapitalizedWords(ruled)
    // Seuls des noms réellement présents sont remplacés : l'IA ne peut rien ajouter au texte.
    return replacePersons(
      ruled,
      persons.filter((name) => ruled.includes(name))
    )
  }
}

/** Détecteur de noms via la passerelle, forcé en local (`anonymiser` est une tâche strictement locale). */
export function personDetectorFrom(gateway: AIGateway): PersonDetector {
  return async (text) => {
    const result = await gateway.run({ kind: 'anonymiser', input: text, schema: PersonsOut, noQueue: true })
    return result.ok ? result.value.data.persons : null
  }
}
