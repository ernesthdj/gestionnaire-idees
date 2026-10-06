import type { CodeLang } from '@shared/ipc/reprise'
import { isBinaryFileName, isSecretFileName } from '../finals/projectPath'

/** Taille maximale d'un fichier analysé (spec 017 FR-013) ; au-delà, il est signalé « trop gros ». */
export const ANALYZED_FILE_MAX_BYTES = 1024 * 1024
/** Au-delà de ce nombre de fichiers retenus, l'aperçu propose de choisir un sous-dossier (spec 017 R1-9). */
export const RETAINED_FILES_MAX = 20_000

/** Dossiers de dépendances, de compilation et de gestion de versions : jamais parcourus. */
const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'vendor',
  'bin',
  'obj',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.vs',
  '.idea'
])

/** Réglages applicatifs qui portent souvent des secrets (chaînes de connexion, mots de passe) : jamais lus. */
const SENSITIVE_SETTINGS = /^(appsettings\..+\.json|web\.config|secrets\.json|.+\.publishsettings)$/

const LANGS: Readonly<Record<string, CodeLang>> = {
  ts: 'ts',
  mts: 'ts',
  cts: 'ts',
  tsx: 'tsx',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'js',
  cs: 'cs',
  php: 'php'
}

export type FileVerdict =
  | { readonly kind: 'retained'; readonly lang: CodeLang }
  | { readonly kind: 'sensitive' }
  | { readonly kind: 'ignored' }
  | { readonly kind: 'too_large' }

/** Langage d'un fichier d'après son extension ; `other` : visible dans l'arborescence, sans analyse. */
export function langOf(path: string): CodeLang {
  const name = path.split('/').at(-1)?.toLowerCase() ?? ''
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? 'other' : (LANGS[name.slice(dot + 1)] ?? 'other')
}

/** Dossier jamais parcouru (nom seul, en minuscules). */
export function isExcludedDir(name: string): boolean {
  return EXCLUDED_DIRS.has(name.toLowerCase())
}

/**
 * Sort d'un fichier du projet repris (`path` relatif, `/`) : retenu (avec son langage), sensible (jamais lu ni
 * montré), ignoré (binaire, dossier exclu, `.gitignore`) ou trop gros.
 */
export function classifyFile(path: string, size: number, ignored: (path: string) => boolean): FileVerdict {
  const segments = path.split('/')
  const name = segments.at(-1)?.toLowerCase() ?? ''
  if (isSecretFileName(name) || SENSITIVE_SETTINGS.test(name)) return { kind: 'sensitive' }
  if (segments.slice(0, -1).some(isExcludedDir) || isBinaryFileName(name) || ignored(path)) return { kind: 'ignored' }
  if (size > ANALYZED_FILE_MAX_BYTES) return { kind: 'too_large' }
  return { kind: 'retained', lang: langOf(path) }
}

/** Motif `.gitignore` → expression régulière sur un chemin relatif (`*` et `?` sans `/`, `**` traversant). */
function patternToRegExp(pattern: string): RegExp {
  let source = ''
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern.charAt(index)
    if (char === '*' && pattern.charAt(index + 1) === '*') {
      source += '.*'
      index++
      if (pattern.charAt(index + 1) === '/') index++
    } else if (char === '*') source += '[^/]*'
    else if (char === '?') source += '[^/]'
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`, 'i')
}

/**
 * `.gitignore` de la racine, lu simplement (spec 017 R4) : motifs, dossiers (`/` final), ancrage (`/` initial).
 * Les négations (`!`) sont ignorées : un fichier exclu de plus, jamais un fichier sensible lu de trop.
 */
export function gitignoreMatcher(text: string): (path: string) => boolean {
  const rules = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('!'))
    .map((line) => {
      const directory = line.endsWith('/')
      const body = line.replace(/^\//, '').replace(/\/$/, '')
      // Sans `/` intérieur, le motif vaut à toute profondeur ; avec, il part de la racine.
      const anywhere = !line.replace(/\/$/, '').includes('/')
      return { regexp: patternToRegExp(body), directory, anywhere }
    })
  return (path: string): boolean => {
    const segments = path.split('/')
    return rules.some((rule) => {
      for (let end = 1; end <= segments.length; end++) {
        const isFile = end === segments.length
        if (rule.directory && isFile) continue
        const candidates = rule.anywhere ? [segments[end - 1] ?? ''] : [segments.slice(0, end).join('/')]
        if (candidates.some((candidate) => rule.regexp.test(candidate))) return true
      }
      return false
    })
  }
}
