import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Vérifie qu'un fragment rendu ne présente aucune violation d'accessibilité détectable par axe-core.
 * Le contraste des couleurs est exclu : jsdom ne calcule ni la mise en page ni les couleurs rendues
 * (vérification manuelle, T046).
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? '?'}) : ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
  )
  expect(summary).toEqual([])
}
