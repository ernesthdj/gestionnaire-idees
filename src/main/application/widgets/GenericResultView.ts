import { GENERIC_RESULT_CSS, GENERIC_RESULT_HTML, GENERIC_RESULT_JS } from '@shared/widgets/genericResultView'
import { buildWidgetDocument, type WidgetTheme } from './WidgetDocument'

/** Document du cadre résultat : même enveloppe isolée qu'un widget (CSP sans réseau, prélude, thème). */
export function buildResultDocument(theme: WidgetTheme): string {
  return buildWidgetDocument(
    { title: 'Résultat', html: GENERIC_RESULT_HTML, css: GENERIC_RESULT_CSS, js: GENERIC_RESULT_JS },
    theme
  )
}
