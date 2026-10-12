/**
 * Géométrie du dossier de verre (spec 028 D6, research R5), dans les unités de sa scène : la scène est dessinée à
 * `FOLDER_SCENE` puis mise à l'échelle ; les formes sont donc des tracés fixes. Nos propres tracés : un panneau arrière
 * dont l'onglet est à droite, un verre avant dont l'échancrure est à gauche.
 */
export const FOLDER_SCENE = { width: 180, height: 144 } as const
/** Place au-dessus du panneau arrière où les feuilles montent quand le dossier s'ouvre. */
export const FOLDER_HEADROOM = 46
/**
 * Échelle de la scène sur la carte (retour de mentalyas, 2026-10-12 : à 180 px, le dossier écrasait les nœuds) : un peu
 * moins de deux fois la largeur d'un nœud d'étape ; réduit encore à 50 % le même soir.
 */
export const FOLDER_SCALE = 0.5
/** Taille du nœud sur la carte (scène + place des feuilles), à l'échelle. */
export const FOLDER_NODE_SIZE = {
  width: Math.round(FOLDER_SCENE.width * FOLDER_SCALE),
  height: Math.round((FOLDER_SCENE.height + FOLDER_HEADROOM) * FOLDER_SCALE)
} as const

/** Haut du verre avant dans la scène, et sa hauteur. */
export const FRONT_TOP = 40
export const FRONT_HEIGHT = FOLDER_SCENE.height - FRONT_TOP

/** Feuille d'un fichier, glissée dans la poche. */
export const SHEET = { left: 20, top: 46, width: 140, height: 92 } as const

/** Panneau arrière : corps arrondi, onglet en haut à droite. */
export const BACK_PATH =
  'M0 28A12 12 0 0 1 12 16L96 16C106 16 108 0 120 0L168 0A12 12 0 0 1 180 12L180 132A12 12 0 0 1 168 144' +
  'L12 144A12 12 0 0 1 0 132Z'

/** Verre avant : échancrure à gauche, coins arrondis. */
export const FRONT_PATH =
  'M0 12A12 12 0 0 1 12 0L58 0C70 0 72 12 84 12L168 12A12 12 0 0 1 180 24' +
  `L180 ${FRONT_HEIGHT - 12}A12 12 0 0 1 168 ${FRONT_HEIGHT}L12 ${FRONT_HEIGHT}A12 12 0 0 1 0 ${FRONT_HEIGHT - 12}Z`

/** Place d'une feuille dans l'éventail : −1 … 1 d'un bord à l'autre, 0 pour une seule feuille. */
export function fanSlot(index: number, count: number): number {
  return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1
}
