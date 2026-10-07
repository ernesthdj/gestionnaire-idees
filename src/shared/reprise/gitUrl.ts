/**
 * Contrôle d'une adresse de dépôt git (spec 021 research R8 = spec 017 T028 = spec 020 T026) : fonction pure.
 *
 * Deux formes seulement : `https://hôte[:port]/chemin` et `git@hôte:chemin`. Tout le reste est refusé AVANT de lancer
 * git : `ssh://`, `http://`, `file://`, `ext::` / `fd::` (transports qui exécutent une commande), chemin local, option
 * déguisée (`-…`), espace, caractère de contrôle ou non ASCII, hôte vide ou invalide, chemin remontant (`..`).
 *
 * Un identifiant (`https://user:jeton@hôte/…`) est retiré de `display` et signalé par `hadCredentials` : `url` (seule
 * forme qui le garde) n'est passée qu'à git, une fois, jamais affichée, journalisée ni stockée (spec 017 FR-011).
 */

export const GIT_URL_MAX = 500

export type GitUrlRefusal =
  'EMPTY' | 'TOO_LONG' | 'CONTROL_CHAR' | 'WHITESPACE' | 'NON_ASCII' | 'OPTION' | 'SCHEME' | 'HOST' | 'PATH'

export type GitUrlCheck =
  | {
      readonly ok: true
      /** Adresse à passer à git (identifiant compris s'il y en avait un) : jamais affichée ni stockée. */
      readonly url: string
      /** Adresse sans identifiant : affichage, journal, base. */
      readonly display: string
      readonly host: string
      readonly owner?: string
      readonly repo?: string
      readonly hadCredentials: boolean
    }
  | { readonly ok: false; readonly reason: GitUrlRefusal }

/** Hôte DNS : étiquettes alphanumériques séparées par des points, tirets internes seulement. */
const HOST = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/
/** Caractères admis dans un segment de chemin (avant décodage des `%XX`). */
const SEGMENT = /^(?:[A-Za-z0-9._~@+=,!$&'()*;-]|%[0-9A-Fa-f]{2})+$/
/** Identifiant `user[:secret]` d'une adresse https : caractères d'URL sans `/`, `@`, `?`, `#`. */
const USERINFO = /^[A-Za-z0-9._~%!$&'()*+,;=:-]+$/

const refuse = (reason: GitUrlRefusal): GitUrlCheck => ({ ok: false, reason })

export function checkGitUrl(input: string): GitUrlCheck {
  if (input.length === 0) return refuse('EMPTY')
  if (input.length > GIT_URL_MAX) return refuse('TOO_LONG')
  for (const char of input) {
    if (isControl(char)) return refuse('CONTROL_CHAR')
    if (/\s/u.test(char)) return refuse('WHITESPACE')
    if ((char.codePointAt(0) ?? 0) > 0x7e) return refuse('NON_ASCII')
  }
  if (input.startsWith('-')) return refuse('OPTION')
  if (input.includes('\\') || input.includes('::')) return refuse('SCHEME')

  if (/^https:\/\//i.test(input)) return checkHttps(input.slice('https://'.length))
  if (input.startsWith('git@')) return checkScp(input.slice('git@'.length))
  return refuse('SCHEME')
}

function checkHttps(rest: string): GitUrlCheck {
  const slash = rest.indexOf('/')
  if (slash <= 0) return refuse(slash === 0 ? 'HOST' : 'PATH')
  const authority = rest.slice(0, slash)
  const path = rest.slice(slash + 1)

  const at = authority.lastIndexOf('@')
  const userinfo = at >= 0 ? authority.slice(0, at) : null
  if (userinfo !== null && (userinfo === '' || !USERINFO.test(userinfo))) return refuse('HOST')
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority

  const match = /^([^:]*)(?::(\d{1,5}))?$/.exec(hostPort)
  if (match === null) return refuse('HOST')
  const host = (match[1] ?? '').toLowerCase()
  const port = match[2]
  if (!isHost(host)) return refuse('HOST')
  if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) return refuse('HOST')

  const parts = pathParts(path)
  if (parts === null) return refuse('PATH')

  const hostDisplay = port === undefined ? host : `${host}:${port}`
  const display = `https://${hostDisplay}/${path}`
  return accepted(
    userinfo === null ? display : `https://${userinfo}@${hostDisplay}/${path}`,
    display,
    host,
    parts,
    userinfo !== null
  )
}

function checkScp(rest: string): GitUrlCheck {
  const colon = rest.indexOf(':')
  if (colon <= 0) return refuse('HOST')
  const host = rest.slice(0, colon).toLowerCase()
  if (!isHost(host)) return refuse('HOST')
  const path = rest.slice(colon + 1)
  // `git@hôte:/chemin` (absolu) reste une forme scp valide ; la barre initiale n'entre pas dans les segments.
  const parts = pathParts(path.startsWith('/') ? path.slice(1) : path)
  if (parts === null) return refuse('PATH')
  const url = `git@${host}:${path}`
  return accepted(url, url, host, parts, false)
}

const isHost = (host: string): boolean => HOST.test(host)

/** Caractère de contrôle C0, DEL ou C1. */
function isControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return code < 0x20 || (code >= 0x7f && code <= 0x9f)
}

/** Segments d'un chemin sûr ; `null` si vide, segment vide, remontée (même encodée) ou caractère interdit. */
function pathParts(path: string): string[] | null {
  if (path === '' || path.startsWith('-')) return null
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const parts = trimmed.split('/')
  for (const part of parts) {
    if (!SEGMENT.test(part)) return null
    let decoded: string
    try {
      decoded = decodeURIComponent(part)
    } catch {
      return null
    }
    if (decoded === '.' || decoded === '..' || /[/\\]/.test(decoded) || [...decoded].some(isControl)) return null
  }
  return parts
}

function accepted(url: string, display: string, host: string, parts: string[], hadCredentials: boolean): GitUrlCheck {
  const last = parts[parts.length - 1] ?? ''
  const repo = last.toLowerCase().endsWith('.git') ? last.slice(0, -4) : last
  const owner = parts.length >= 2 ? parts[parts.length - 2] : undefined
  return {
    ok: true,
    url,
    display,
    host,
    ...(owner === undefined ? {} : { owner }),
    ...(repo === '' ? {} : { repo }),
    hadCredentials
  }
}
