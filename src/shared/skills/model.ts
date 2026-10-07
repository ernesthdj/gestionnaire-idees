/**
 * Modèle partagé de l'arbre de skills (spec 020) : familles, identifiants, domaines de départ, grille de qualité,
 * extensions exécutables. Aucun chemin n'est jamais transmis au renderer : seulement des identifiants calculés par le
 * main (`perso:<nom>`, `projet:<genesisId>:<nom>`, `plugin:<marketplace>/<plugin>:<nom>`).
 */

export const SKILL_FAMILIES = ['perso', 'projet', 'plugin'] as const
export type SkillFamily = (typeof SKILL_FAMILIES)[number]

export const FAMILY_LABELS: Readonly<Record<SkillFamily, string>> = {
  perso: 'Personnel',
  projet: 'De projet',
  plugin: 'De plugin'
}

/** Nom de dossier d'un skill : minuscules, chiffres, tirets ; sinon le skill est « abîmé » et non modifiable. */
export const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/

/** Taille maximale d'un `SKILL.md` lu (au-delà : `TOO_LARGE`, nœud abîmé). */
export const SKILL_MD_MAX_BYTES = 200 * 1024
/** Fichiers annexes listés au plus par skill. */
export const SKILL_FILES_MAX = 300

/** Extensions considérées comme exécutables (repère ⚠, jamais écrites depuis un brouillon de Claude). */
export const EXECUTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.psm1',
  '.bat',
  '.cmd',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.py',
  '.rb',
  '.pl',
  '.exe',
  '.dll',
  '.com',
  '.vbs'
])

/** Domaines de départ (branches de l'arbre au lot B) ; Claude peut en proposer d'autres. */
export const SEED_DOMAINS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'projet', label: 'Projet & organisation' },
  { id: 'design', label: 'Design & UI' },
  { id: 'docs', label: 'Docs & cours' },
  { id: 'code', label: 'Code & qualité' },
  { id: 'donnees', label: 'Données & IA' },
  { id: 'media', label: 'Photo & médias' },
  { id: 'divers', label: 'Divers' }
]

/** Critères de la grille de qualité (lot B), chacun noté 0–5 et justifié. */
export const QUALITY_CRITERIA = ['declencheurs', 'profondeur', 'garde_fous', 'exemples'] as const
export type QualityCriterion = (typeof QUALITY_CRITERIA)[number]

/** Identifiant d'un skill personnel. */
export const persoId = (name: string): string => `perso:${name}`
/** Identifiant d'un skill de projet (genesis lié). */
export const projetId = (genesisId: string, name: string): string => `projet:${genesisId}:${name}`
/** Identifiant d'un skill de plugin (dernière version du plugin). */
export const pluginId = (marketplace: string, plugin: string, name: string): string =>
  `plugin:${marketplace}/${plugin}:${name}`

/** Famille d'un identifiant, `null` s'il est mal formé. */
export function familyOf(skillId: string): SkillFamily | null {
  const prefix = skillId.slice(0, skillId.indexOf(':'))
  return (SKILL_FAMILIES as readonly string[]).includes(prefix) ? (prefix as SkillFamily) : null
}
