import type { Nature } from '@shared/ipc/neurons'
import { normalizeQuestion } from './guards'

/** Dimensions de référence par nature (analyse U1) : orientent les questions vers l'exécution ou l'exploration. */
export const REFERENCE_DIMENSIONS: Readonly<Record<Nature, readonly string[]>> = {
  action: ['quand', 'combien', 'comment', "source d'argent", 'lieu', 'dépendances'],
  reflection: ['pourquoi', 'options', 'critères', 'contraintes', 'risques', 'décision attendue']
}

/**
 * Vrai si la dimension d'une question ne relève d'aucune dimension de référence de la nature :
 * l'interface la signale (question hors de l'orientation choisie), sans la retirer.
 */
export function isOutsideNature(dimension: string, nature: Nature): boolean {
  const key = normalizeQuestion(dimension)
  return !REFERENCE_DIMENSIONS[nature].some((reference) => {
    const expected = normalizeQuestion(reference)
    return key === expected || key.includes(expected)
  })
}
