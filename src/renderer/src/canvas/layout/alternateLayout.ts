/**
 * Disposition en sens alterné (spec 017 D17, spec 022 D11) : les enfants d'une racine descendent en colonne sous elle,
 * ceux d'un niveau impair partent en ligne à droite, ceux d'un niveau pair repartent en colonne dessous, et ainsi de
 * suite. Chaque sous-arbre occupe sa boîte, qui pousse les voisins : rien ne se chevauche. `transposed` inverse le sens
 * (« Réorganiser », D22). Partagée par la carte de structure et les plans d'attaque. Fonctions pures.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

export interface AlternateOptions {
  /** Enfants affichés d'un nœud, dans l'ordre (le repli est appliqué par l'appelant). */
  readonly childrenOf: (id: string) => readonly string[]
  /** Encombrement d'un nœud (sa case). */
  readonly sizeOf: (id: string) => Size
  /** Écart entre deux frères d'une ligne (`across`) ou d'une colonne (`down`). */
  readonly across: number
  readonly down: number
  /** Niveau impair en colonne et pair en ligne, au lieu de l'inverse. */
  readonly transposed?: boolean
  /** Appelé pour chaque nœud placé (centre), avant ses enfants, avec la liste de ceux-ci. */
  readonly visit: (id: string, depth: number, center: Point, kids: readonly string[]) => void
}

/** Place le sous-arbre de `id` (profondeur `depth`), coin haut gauche en (x, y) ; renvoie la taille de sa boîte. */
export function layoutSubtree(id: string, depth: number, x: number, y: number, options: AlternateOptions): Size {
  const { width: W, height: H } = options.sizeOf(id)
  const kids = options.childrenOf(id)
  options.visit(id, depth, { x: x + W / 2, y: y + H / 2 }, kids)
  let width = W
  let height = H
  const inRow = (depth % 2 === 1) !== (options.transposed === true)
  if (inRow) {
    let cursor = x + W + options.across
    for (const kid of kids) {
      const box = layoutSubtree(kid, depth + 1, cursor, y, options)
      cursor += box.width + options.across
      height = Math.max(height, box.height)
    }
    if (kids.length > 0) width = cursor - options.across - x
  } else {
    let cursor = y + H + options.down
    for (const kid of kids) {
      const box = layoutSubtree(kid, depth + 1, x, cursor, options)
      cursor += box.height + options.down
      width = Math.max(width, box.width)
    }
    if (kids.length > 0) height = cursor - options.down - y
  }
  return { width, height }
}

/**
 * Enfants (niveau 1) d'une racine placée en `center` : empilés sous elle à partir de `gap`, alignés sur elle, avec
 * `extra` d'air en plus entre deux ; transposé, ils partent à sa droite. Renvoie ces enfants.
 */
export function layoutUnder(
  rootId: string,
  center: Point,
  gap: number,
  extra: number,
  options: AlternateOptions
): readonly string[] {
  const kids = options.childrenOf(rootId)
  if (options.transposed === true) {
    let cursor = center.x + gap
    for (const kid of kids) {
      const { height } = options.sizeOf(kid)
      cursor += layoutSubtree(kid, 1, cursor, center.y - height / 2, options).width + options.across + extra
    }
  } else {
    let cursor = center.y + gap
    for (const kid of kids) {
      const { width } = options.sizeOf(kid)
      cursor += layoutSubtree(kid, 1, center.x - width / 2, cursor, options).height + options.down + extra
    }
  }
  return kids
}
