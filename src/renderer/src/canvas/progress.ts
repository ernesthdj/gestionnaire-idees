import type { ElementView } from '@shared/ipc/canvas'

/** Avancement affiché d'un élément (spec 017 D21) ; `fromChildren` : moyenne de ses sous-éléments. */
export interface ElementProgress {
  readonly percent: number
  readonly fromChildren: boolean
}

const DONE = new Set(['livree', 'faite'])

/**
 * Avancement mixte (D21, amendé le 2026-10-08) : un élément qui a des sous-éléments affiche **toujours** la moyenne de
 * ceux-ci (un sous-élément sans information compte 0) dès que l'un d'eux en a une, même s'il est marqué livré : un
 * sous-élément rouvert fait baisser son parent. Une feuille livrée ou faite vaut 100 %, sinon l'avancement déclaré par
 * Claude. Sans aucune information : le statut livré du parent (100 %), sinon absent. Fonction pure.
 */
export function progressOf(elements: readonly ElementView[]): ReadonlyMap<string, ElementProgress> {
  const children = new Map<string, ElementView[]>()
  for (const element of elements) children.set(element.parentId, [...(children.get(element.parentId) ?? []), element])
  const memo = new Map<string, ElementProgress | null>()
  const visiting = new Set<string>()
  const of = (element: ElementView): ElementProgress | null => {
    const known = memo.get(element.id)
    if (known !== undefined) return known
    if (visiting.has(element.id)) return null
    visiting.add(element.id)
    let result: ElementProgress | null = null
    const kids = children.get(element.id) ?? []
    const values = kids.map(of)
    if (kids.length > 0 && values.some((value) => value !== null)) {
      const total = values.reduce((sum, value) => sum + (value?.percent ?? 0), 0)
      result = { percent: Math.round(total / kids.length), fromChildren: true }
    } else if (element.status !== null && DONE.has(element.status)) {
      result = { percent: 100, fromChildren: false }
    } else if (typeof element.progress === 'number') {
      result = { percent: Math.max(0, Math.min(100, element.progress)), fromChildren: false }
    }
    visiting.delete(element.id)
    memo.set(element.id, result)
    return result
  }
  const progress = new Map<string, ElementProgress>()
  for (const element of elements) {
    const value = of(element)
    if (value !== null) progress.set(element.id, value)
  }
  return progress
}
