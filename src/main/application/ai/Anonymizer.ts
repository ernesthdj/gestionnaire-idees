import { SensitiveOut } from '@shared/ai/schemas'
import { applyDeterministicRules, maskCapitalizedWords, replaceTerms } from '../../domain/ai/anonymizationRules'
import type { AIGateway } from './AIGateway'
import type { Anonymizer as AnonymizerPort } from './ports'

export interface SensitiveNames {
  readonly persons: readonly string[]
  readonly places: readonly string[]
}

/** Renvoie les personnes et lieux présents dans le texte, ou `null` si la détection est indisponible. */
export type SensitiveDetector = (text: string) => Promise<SensitiveNames | null>

/**
 * Anonymisation en deux couches (research R6) :
 * 1. règles déterministes (liens, e-mails, IBAN, téléphones, adresses, codes postaux ; montants → fourchettes
 *    si le réglage « Masquer les montants » est actif) ;
 * 2. personnes et lieux listés par l'IA locale, sinon repli heuristique sur les mots capitalisés.
 * L'IA locale ne voit que le texte déjà passé par la couche 1 et ne fait que lister : c'est le code qui remplace.
 */
export class Anonymizer implements AnonymizerPort {
  constructor(
    private readonly deps: {
      readonly detectSensitive: SensitiveDetector
      /** Lu à chaque appel : le réglage s'applique sans redémarrage. Masqués si absent (sûr par défaut). */
      readonly maskAmounts?: () => boolean
    }
  ) {}

  async anonymize(text: string): Promise<string> {
    const ruled = applyDeterministicRules(text, { maskAmounts: this.deps.maskAmounts?.() ?? true })
    let detected: SensitiveNames | null
    try {
      detected = await this.deps.detectSensitive(ruled)
    } catch {
      detected = null
    }
    if (detected === null) return maskCapitalizedWords(ruled)
    // Seuls des termes réellement présents sont remplacés : l'IA ne peut rien ajouter au texte.
    const present = (term: string): boolean => ruled.includes(term)
    return replaceTerms(ruled, [
      ...detected.persons.filter(present).map((term) => ({ term, placeholder: '[personne]' })),
      ...detected.places.filter(present).map((term) => ({ term, placeholder: '[lieu]' }))
    ])
  }
}

/** Détecteur via la passerelle, forcé en local (`anonymiser` est une tâche strictement locale). */
export function sensitiveDetectorFrom(gateway: AIGateway): SensitiveDetector {
  return async (text) => {
    const result = await gateway.run({ kind: 'anonymiser', input: text, schema: SensitiveOut, noQueue: true })
    return result.ok ? result.value.data : null
  }
}
