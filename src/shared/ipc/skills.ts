import type { SkillFamily } from '../skills/model'

/** Vues de l'arbre de skills (spec 020, contrats `skills:*`). Aucun chemin absolu n'y figure. */

export interface SkillView {
  /** Identifiant calculé par le main : `perso:<nom>`, `projet:<genesisId>:<nom>`, `plugin:<market>/<plugin>:<nom>`. */
  readonly id: string
  readonly family: SkillFamily
  /** Nom du dossier du skill. */
  readonly name: string
  /** Description de l'en-tête (vide si le skill est abîmé). */
  readonly description: string
  /** Libellé lisible de l'origine, sans chemin : « personnel », « projet Recettes », « plugin vercel 0.50.0 ». */
  readonly origin: string
  /** Le skill contient au moins un fichier exécutable (repère ⚠). */
  readonly hasScripts: boolean
  /** En-tête absent ou invalide, nom de dossier non conforme ou `SKILL.md` trop gros : non modifiable. */
  readonly damaged: boolean
  /** Identifiants des autres skills qui portent le même nom (research R1 : simple mention). */
  readonly sameNameAs: readonly string[]
  readonly modifiedAt: number
  /** Empreinte du `SKILL.md` (fiche à refaire quand elle change, lot B). */
  readonly contentHash: string
}

export interface SkillLinkView {
  readonly from: string
  readonly to: string
  readonly kind: 'appelle'
  /** Ligne du `SKILL.md` de `from` où l'appel est écrit. */
  readonly line: number
}

export interface SkillsView {
  readonly skills: readonly SkillView[]
  readonly links: readonly SkillLinkView[]
  readonly scannedAt: number
}

export interface SkillFileView {
  /** Relatif au dossier du skill, séparateur `/`. */
  readonly path: string
  readonly size: number
  readonly executable: boolean
}

export interface SkillDetailView {
  readonly skill: SkillView
  /** Texte du `SKILL.md` (≤ 200 Ko) ; jamais interprété comme du HTML. */
  readonly markdown: string
  readonly files: readonly SkillFileView[]
  /** Plus de fichiers que la limite listée. */
  readonly filesTruncated: boolean
}

export interface SkillsChangedEvent {
  readonly scannedAt: number
}
