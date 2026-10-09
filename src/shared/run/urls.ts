// « Ouvrir dans le navigateur » (spec 025) : partagé par le panneau (bouton) et le main (revérification).
/** Adresse locale annoncée par un serveur de dev (`localhost`, `127.0.0.1`, `0.0.0.0`, `[::1]`), avec port et chemin. */
// L'hôte ne doit pas continuer en nom de domaine (`localhost.exemple.org` est distant).
const LOCAL_URL =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?![\w-]|\.[\w-])(?::\d{1,5})?(?:\/[^\s'"<>`)\]]*)?/gi

/**
 * Adresses locales d'une sortie (spec 025, « Ouvrir dans le navigateur »), dans l'ordre, sans doublon ; `0.0.0.0`
 * (« toutes les interfaces ») devient `localhost`. Les codes couleur sont retirés avant. Pur.
 */
export function localUrls(output: string): string[] {
  // eslint-disable-next-line no-control-regex -- séquences ANSI (ESC)
  const plain = output.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
  const found = (plain.match(LOCAL_URL) ?? []).map((url) =>
    url.replace(/^(https?:\/\/)0\.0\.0\.0/i, '$1localhost').replace(/[.,;:]+$/, '')
  )
  return [...new Set(found)]
}
