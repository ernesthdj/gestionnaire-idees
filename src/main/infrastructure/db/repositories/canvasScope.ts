/** Brainstorm actif vu des dépôts de la carte (spec 024 R1) ; absent : une seule carte (tests, outils hors app). */
export interface CanvasScope {
  /** Canevas affiché ; `null` : aucun (Project Manager), la carte est vide. */
  active(): string | null
  /** Brainstorm de ce qui naît maintenant. */
  forNew(): string
}
