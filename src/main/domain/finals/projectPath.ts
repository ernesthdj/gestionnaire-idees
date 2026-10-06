/**
 * Contrôle pur d'un chemin de fichier demandé par Claude pendant une exécution (spec 013 R2) : relatif au dossier du
 * projet lié, sans remontée, sans nom réservé Windows, hors des fichiers sensibles et binaires. Le contrôle sur le
 * disque (liens symboliques, `realpath`) se fait ensuite dans `ProjectFiles`.
 */

export const PROJECT_PATH_MAX = 260

export type ProjectPathCheck =
  { readonly ok: true; readonly path: string; readonly key: string } | { readonly ok: false; readonly reason: string }

/** Noms de périphériques réservés par Windows (même avec une extension). */
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9]|conin\$|conout\$)$/
/** Caractères interdits dans un nom Windows (et `:`, flux alternatifs). */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>:"|?*\u0000-\u001f]/

/** Dossiers où Claude n'écrit jamais : données internes de git, dépendances installées, réglages d'agents. */
const BLOCKED_FOLDERS = new Set(['.git', 'node_modules', 'vendor', '.claude'])

/** Fichiers de secrets ou d'accès. */
const SECRET_NAMES = /^(\.env(\..+)?|\.npmrc|\.pypirc|\.netrc|\.git-credentials|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?)$/
const SECRET_EXTENSIONS = new Set(['key', 'pem', 'p12', 'pfx', 'crt', 'cer', 'der', 'jks', 'keystore'])
/** Modèles d'environnement sans secret, d'usage courant dans un dépôt : autorisés. */
const ENV_TEMPLATES = new Set(['.env.example', '.env.sample', '.env.template'])

/** Fichiers binaires ou exécutables connus : la v1 écrit du texte seulement, jamais un programme lancé par Windows. */
const BINARY_EXTENSIONS = new Set([
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'msi',
  'bat',
  'cmd',
  'com',
  'scr',
  'ps1',
  'vbs',
  'lnk',
  'reg',
  'zip',
  '7z',
  'rar',
  'tar',
  'gz',
  'bz2',
  'xz',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'tif',
  'tiff',
  'psd',
  'arw',
  'cr2',
  'nef',
  'dng',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'mp3',
  'mp4',
  'wav',
  'ogg',
  'mov',
  'avi',
  'webm',
  'sqlite',
  'db',
  'class',
  'jar',
  'pyc',
  'node',
  'wasm'
])

const refuse = (reason: string): ProjectPathCheck => ({ ok: false, reason })

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1)
}

/** Chemin normalisé (`/`) et sa clé (minuscules : Windows ignore la casse), ou la raison du refus. */
export function checkProjectPath(input: string): ProjectPathCheck {
  if (input.length === 0 || input.length > PROJECT_PATH_MAX) {
    return refuse(`chemin vide ou trop long (${PROJECT_PATH_MAX} caractères au plus)`)
  }
  const path = input.replace(/\\/g, '/')
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return refuse('chemin absolu : donne un chemin relatif au dossier du projet')
  }
  const segments = path.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      return refuse('segment vide, « . » ou « .. » : le chemin doit rester dans le dossier du projet')
    }
    if (FORBIDDEN.test(segment)) return refuse(`caractère interdit dans « ${segment} »`)
    if (/[. ]$/.test(segment)) return refuse(`« ${segment} » finit par un point ou une espace`)
    if (RESERVED.test(segment.toLowerCase().split('.')[0] ?? '')) {
      return refuse(`« ${segment} » est un nom réservé par Windows`)
    }
  }
  const lower = segments.map((segment) => segment.toLowerCase())
  const blocked = lower.find((segment) => BLOCKED_FOLDERS.has(segment))
  if (blocked !== undefined) return refuse(`dossier protégé (${blocked}) : Claude n’y écrit jamais`)
  const name = lower.at(-1) ?? ''
  const original = segments.at(-1) ?? ''
  if (!ENV_TEMPLATES.has(name) && (SECRET_NAMES.test(name) || SECRET_EXTENSIONS.has(extensionOf(name)))) {
    return refuse(`« ${original} » est un fichier de secrets ou de clés : Claude n’y écrit jamais`)
  }
  if (BINARY_EXTENSIONS.has(extensionOf(name))) return refuse(`« ${original} » n’est pas un fichier texte`)
  return { ok: true, path, key: lower.join('/') }
}
