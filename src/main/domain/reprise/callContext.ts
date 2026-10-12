/**
 * Contexte d'un appel ambigu (spec 017 US6) : au plus `max` lignes du code de l'élément qui appelle, centrées sur la
 * première ligne qui nomme l'appelé. Fonction pure ; le texte n'est jamais plus long que ce que la tâche accepte.
 *
 * @param lines  lignes du fichier (indice 0 = ligne 1)
 * @param start  première ligne (1-based) de l'élément appelant
 * @param end    dernière ligne (1-based) de l'élément appelant
 * @param callee nom appelé (`Save` pour `store.Save`)
 */
export function callContext(
  lines: readonly string[],
  start: number,
  end: number,
  callee: string,
  max = 8
): readonly string[] {
  const first = Math.max(1, Math.min(start, lines.length))
  const last = Math.max(first, Math.min(end, lines.length))
  if (lines.length === 0 || max <= 0) return []
  const needle = callee.trim()
  let hit = -1
  if (needle !== '') {
    for (let index = first - 1; index < last; index++) {
      if ((lines[index] ?? '').includes(needle)) {
        hit = index
        break
      }
    }
  }
  // Appel introuvable dans la plage (symbole de fichier, appel généré) : le début de l'élément.
  const centre = hit === -1 ? first - 1 : hit
  const before = hit === -1 ? 0 : Math.floor((max - 1) / 2)
  let from = Math.max(first - 1, centre - before)
  const to = Math.min(last, from + max)
  from = Math.max(first - 1, to - max)
  return lines.slice(from, to).map((line) => line.replace(/\s+$/, ''))
}

/** Dernier segment d'un appel : `store.Save` → `Save`, `Order::all` → `all`, `$this->save` → `save`. */
export function calleeOf(rawTarget: string): string {
  return rawTarget.split(/\\|\.|::|->/).at(-1) ?? rawTarget
}
