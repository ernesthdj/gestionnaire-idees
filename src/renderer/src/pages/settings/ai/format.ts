/** Formatage des montants et du budget pour l'écran Réglages › IA (logique pure, testable). */

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

/** Convertit une saisie en euros (« 10 », « 12,50 ») en centimes, ou `null` si invalide. */
export function parseEurosToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const cents = Math.round(Number.parseFloat(normalized) * 100)
  return cents <= 100_000 ? cents : null
}

/** Pourcentage du plafond consommé, borné entre 0 et 100. */
export function budgetPercent(spentCents: number, capCents: number): number {
  if (capCents <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((spentCents / capCents) * 100)))
}
