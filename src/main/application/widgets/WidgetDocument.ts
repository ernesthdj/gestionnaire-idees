/**
 * Document d'un widget servi par le protocole `gi-widget://` (spec 004 FR-007, plan § Isolation). Il n'existe que
 * dans le bac à sable : jamais évalué ni injecté dans l'application.
 */

/**
 * Politique de sécurité du contenu : scripts et styles en ligne seulement, images et polices en `data:`, AUCUNE
 * connexion (pas de `connect-src`, `default-src 'none'`), aucun cadre, aucune soumission. Envoyée en en-tête ET en
 * `<meta>` (défense en profondeur).
 */
export const WIDGET_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

/** Jetons de couleur de l'application transmis au widget (valeurs réelles du thème affiché). */
export const THEME_TOKENS = ['surface', 'surface-raised', 'content', 'content-muted', 'accent', 'pro', 'con'] as const
export type ThemeToken = (typeof THEME_TOKENS)[number]

export interface WidgetTheme {
  readonly scheme: 'light' | 'dark'
  readonly colors: Readonly<Partial<Record<ThemeToken, string>>>
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i

/** Couleurs de secours (thème clair) si l'interface n'en fournit pas. */
const FALLBACK: Readonly<Record<'light' | 'dark', Record<ThemeToken, string>>> = {
  light: {
    surface: '#ffffff',
    'surface-raised': '#f4f4f5',
    content: '#18181b',
    'content-muted': '#52525b',
    accent: '#2563eb',
    pro: '#15803d',
    con: '#b91c1c'
  },
  dark: {
    surface: '#18181b',
    'surface-raised': '#27272a',
    content: '#fafafa',
    'content-muted': '#a1a1aa',
    accent: '#60a5fa',
    pro: '#4ade80',
    con: '#f87171'
  }
}

/** Thème lu dans l'URL du cadre : seules des couleurs hexadécimales sont retenues (rien d'autre n'entre dans le CSS). */
export function themeFromQuery(query: URLSearchParams): WidgetTheme {
  const scheme = query.get('scheme') === 'dark' ? 'dark' : 'light'
  const colors: Partial<Record<ThemeToken, string>> = {}
  for (const token of THEME_TOKENS) {
    const value = query.get(token)?.trim()
    if (value !== undefined && HEX_COLOR.test(value)) colors[token] = value
  }
  return { scheme, colors }
}

/** Largeur de mise en page d'un widget (spec 026) : plus étroit, son contenu est réduit d'autant, jusqu'à la moitié. */
export const WIDGET_DESIGN_WIDTH = 760
const WIDGET_MIN_ZOOM = 0.5

/**
 * Prélude exécuté avant le widget :
 * - WebRTC neutralisé (il contourne la CSP) ;
 * - erreurs du widget affichées dans un bandeau (utile pour demander une correction à Claude) ;
 * - pont `window.gi` (spec 005), entrées et sortie : il ne fait que relayer — la barrière est côté main, qui ne
 *   remet que les données autorisées et n'accepte qu'un résultat dans ses bornes.
 */
const PRELUDE = `(() => {
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate']) {
    try { Object.defineProperty(window, name, { value: undefined, writable: false, configurable: false }) } catch {}
  }
  const show = (message, prefix = 'Erreur dans le widget : ') => {
    let bar = document.getElementById('gi-widget-error')
    if (bar === null) {
      bar = document.createElement('div')
      bar.id = 'gi-widget-error'
      bar.setAttribute('role', 'alert')
      document.body.append(bar)
    }
    bar.textContent = prefix + String(message).slice(0, 300)
  }
  // Pont (spec 005) : l'application remet les données autorisées (gi.onInputs) ; le widget publie un résultat
  // (gi.output), que l'application vérifie avant de l'afficher dans le cadre résultat.
  let inputs = []
  let received = false
  const listeners = []
  // État (spec 026) : remis une fois à l'ouverture, enregistré par l'application (bornes vérifiées par le main).
  let state = null
  let stateReceived = false
  const stateListeners = []
  const plainJson = (data, what) => {
    let plain
    try { plain = JSON.parse(JSON.stringify(data)) } catch { plain = undefined }
    if (plain === undefined) show(what + ' doit être du JSON (objets, listes, textes, nombres).', 'Refusé : ')
    return plain
  }
  const gi = Object.freeze({
    get inputs() { return inputs },
    onInputs(callback) {
      if (typeof callback !== 'function') return
      listeners.push(callback)
      if (received) callback(inputs)
    },
    output(data) {
      const plain = plainJson(data, 'le résultat')
      if (plain !== undefined) window.parent.postMessage({ type: 'gi:output', data: plain }, '*')
    },
    get state() { return state },
    onState(callback) {
      if (typeof callback !== 'function') return
      if (stateReceived) callback(state)
      else stateListeners.push(callback)
    },
    saveState(data) {
      const plain = plainJson(data, 'l’état')
      if (plain === undefined) return
      state = plain
      window.parent.postMessage({ type: 'gi:saveState', data: plain }, '*')
    }
  })
  Object.defineProperty(window, 'gi', { value: gi, writable: false, configurable: false })
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return
    const data = event.data
    if (data === null || typeof data !== 'object') return
    if (data.type === 'gi:refused' && typeof data.message === 'string') { show(data.message, ''); return }
    if (data.type === 'gi:state' && 'state' in data) {
      if (stateReceived) return
      state = data.state
      stateReceived = true
      for (const listener of stateListeners.splice(0)) {
        try { listener(state) } catch (error) { show(error instanceof Error ? error.message : error) }
      }
      return
    }
    if (data.type !== 'gi:inputs' || !Array.isArray(data.inputs)) return
    inputs = data.inputs
    received = true
    for (const listener of listeners) {
      try { listener(inputs) } catch (error) { show(error instanceof Error ? error.message : error) }
    }
  })
  // Échelle (spec 026) : le widget est mis en page sur au moins WIDGET_DESIGN_WIDTH px, puis réduit pour tenir dans son
  // bloc ; il garde ainsi l'échelle des nœuds de la carte au lieu d'afficher un contenu trop grand.
  const fit = () => {
    const zoom = Math.min(1, Math.max(${WIDGET_MIN_ZOOM}, window.innerWidth / ${WIDGET_DESIGN_WIDTH}))
    document.documentElement.style.setProperty('--gi-zoom', zoom.toFixed(3))
  }
  fit()
  window.addEventListener('resize', fit)
  window.parent.postMessage({ type: 'gi:ready' }, '*')
  window.addEventListener('error', (event) => show(event.message))
  window.addEventListener('unhandledrejection', (event) => show(event.reason instanceof Error ? event.reason.message : event.reason))
})()`

/** Empêche une partie du widget de refermer son propre bloc `<style>` / `<script>` (le document reste bien formé). */
function neutralize(text: string, tag: 'style' | 'script'): string {
  return text.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1')
}

export interface WidgetParts {
  readonly title: string
  readonly html: string
  readonly css: string
  readonly js: string
}

export function buildWidgetDocument(parts: WidgetParts, theme: WidgetTheme): string {
  const colors = { ...FALLBACK[theme.scheme], ...theme.colors }
  const variables = THEME_TOKENS.map((token) => `--color-${token}: ${colors[token]};`).join(' ')
  const title = parts.title.replace(/[<>&"]/g, '')
  return `<!doctype html>
<html lang="fr" data-theme="${theme.scheme}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${WIDGET_CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root { ${variables} --font: 'Segoe UI', system-ui, sans-serif; color-scheme: ${theme.scheme}; --gi-error-ink: ${theme.scheme === 'dark' ? '#18181b' : '#ffffff'}; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; width: 100%; height: 100%; background: var(--color-surface); color: var(--color-content); font-family: var(--font); font-size: 14px; }
html { zoom: var(--gi-zoom, 1); width: calc(100vw / var(--gi-zoom, 1)) !important; height: calc(100vh / var(--gi-zoom, 1)) !important; }
#gi-widget-error { position: fixed; left: 0; right: 0; bottom: 0; padding: 6px 8px; background: var(--color-con); color: var(--gi-error-ink); font: 12px var(--font); z-index: 2147483647; }
</style>
<style>
${neutralize(parts.css, 'style')}
</style>
</head>
<body>
${parts.html}
<script>${PRELUDE}</script>
<script type="module">
${neutralize(parts.js, 'script')}
</script>
</body>
</html>`
}
