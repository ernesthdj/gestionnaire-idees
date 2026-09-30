import { protocol, type Session } from 'electron'
import { buildWidgetDocument, themeFromQuery, WIDGET_CSP } from '../application/widgets/WidgetDocument'
import { leavesWidgetSandbox, parseWidgetUrl, WIDGET_SCHEME } from '../application/widgets/widgetUrl'
import type { WidgetRepository } from '../infrastructure/db/repositories/WidgetRepository'

/** À appeler AVANT `app.whenReady` (exigence d'Electron). Schéma standard : URL analysables, origine distincte. */
export function registerWidgetScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: WIDGET_SCHEME, privileges: { standard: true } }])
}

/**
 * Sert les documents des widgets et coupe tout le reste :
 * - le document n'existe que pour une version d'un widget visible ;
 * - CSP en en-tête (et en `<meta>` dans le document) : aucune connexion ;
 * - toute requête émise PAR un document `gi-widget:` vers un autre protocole est annulée (défense en profondeur,
 *   même si une CSP était contournée).
 */
export function installWidgetProtocol(session: Session, widgets: WidgetRepository): void {
  session.protocol.handle(WIDGET_SCHEME, (request) => {
    const target = parseWidgetUrl(request.url)
    const version = target === null ? undefined : widgets.version(target.blockId, target.versionId)
    if (target === null || version === undefined || widgets.widget(target.blockId) === undefined) {
      return new Response('Widget introuvable', { status: 404, headers: { 'content-type': 'text/plain' } })
    }
    const html = buildWidgetDocument(version, themeFromQuery(new URL(request.url).searchParams))
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': WIDGET_CSP,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer'
      }
    })
  })

  session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: leavesWidgetSandbox(details.frame?.url ?? details.referrer, details.url) })
  })
}
