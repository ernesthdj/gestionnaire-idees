/** Dézoomer en deçà de cette part du cadrage d'arrivée remonte d'un niveau (spec 017 D10). */
export const ZOOM_OUT_RATIO = 0.6
/** Zoomer au-delà de ce multiple du cadrage d'arrivée ouvre l'élément au centre. */
export const ZOOM_IN_RATIO = 2

/**
 * Zoom sémantique de l'explorateur (spec 017 D10) : les seuils suivent le cadrage d'arrivée du niveau (un petit niveau
 * est cadré très près, un grand très loin), sinon un niveau cadré à 2,5 obligerait à dézoomer sans fin. Pure.
 */
export function semanticZoom(zoom: number, arrival: number, atRoot: boolean): 'up' | 'open' | null {
  if (!atRoot && zoom <= arrival * ZOOM_OUT_RATIO) return 'up'
  if (zoom >= arrival * ZOOM_IN_RATIO) return 'open'
  return null
}
