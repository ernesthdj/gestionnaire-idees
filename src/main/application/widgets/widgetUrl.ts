/** Protocole des widgets (spec 004 FR-007) : `gi-widget://widget/<bloc>/<version>?scheme=dark&surface=%23…`. */
export const WIDGET_SCHEME = 'gi-widget'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Adresse d'un document de widget, analysée et validée ; `null` si elle ne désigne pas un widget. */
export function parseWidgetUrl(url: string): { readonly blockId: string; readonly versionId: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${WIDGET_SCHEME}:` || parsed.hostname !== 'widget') return null
  const [blockId, versionId, ...rest] = parsed.pathname.split('/').filter((part) => part !== '')
  if (blockId === undefined || versionId === undefined || rest.length > 0) return null
  return UUID.test(blockId) && UUID.test(versionId) ? { blockId, versionId } : null
}

/** Adresse du document d'un cadre résultat (spec 005 FR-006) : `gi-widget://result/<bloc>?scheme=…`. */
export function parseResultUrl(url: string): { readonly blockId: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${WIDGET_SCHEME}:` || parsed.hostname !== 'result') return null
  const [blockId, ...rest] = parsed.pathname.split('/').filter((part) => part !== '')
  return blockId !== undefined && rest.length === 0 && UUID.test(blockId) ? { blockId } : null
}

/**
 * Vrai si une requête émise par un document de widget sort du protocole des widgets : elle doit être annulée
 * (défense en profondeur, FR-007 — même si la CSP du document était contournée).
 */
export function leavesWidgetSandbox(from: string, url: string): boolean {
  const prefix = `${WIDGET_SCHEME}:`
  return from.startsWith(prefix) && !url.startsWith(prefix)
}
