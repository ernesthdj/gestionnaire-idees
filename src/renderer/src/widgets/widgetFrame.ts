/** Jetons de couleur transmis au widget : ceux que le cadre système de Claude lui demande d'utiliser. */
const TOKENS = ['surface', 'surface-raised', 'content', 'content-muted', 'accent', 'pro', 'con'] as const

/** Thème réellement affiché : réglage de l'app, ou préférence système. */
export function resolvedScheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Thème affiché et valeurs réelles des jetons de couleur (tokens.css reste la seule source). */
function themeQuery(scheme: 'light' | 'dark'): string {
  const style = getComputedStyle(document.documentElement)
  const query = new URLSearchParams({ scheme })
  for (const token of TOKENS) {
    const value = style.getPropertyValue(`--color-${token}`).trim()
    if (value !== '') query.set(token, value)
  }
  return query.toString()
}

/**
 * Adresse du document isolé d'une version de widget (spec 004 FR-011) ; le main ne retient du thème que des
 * couleurs hexadécimales.
 */
export function widgetFrameUrl(blockId: string, versionId: string, scheme: 'light' | 'dark'): string {
  return `gi-widget://widget/${blockId}/${versionId}?${themeQuery(scheme)}`
}

/** Adresse du document isolé d'un cadre résultat (spec 005 FR-006). */
export function resultFrameUrl(blockId: string, scheme: 'light' | 'dark'): string {
  return `gi-widget://result/${blockId}?${themeQuery(scheme)}`
}
