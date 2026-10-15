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
  '.idea',
  // Outillage et doc utiles seulement à l'IA (spec 032 Q9) : ils chargent l'explorateur sans éclairer l'architecture.
  '.claude',
  '.specify',
  '.kilo',
  '.cursor',
  '.obsidian',
  '.analyste',
  'graphify-out',
  'test-results'
])
/** Chemins (depuis la racine, en minuscules) de doc pour l'IA seulement : dossiers, puis fichiers (spec 032 Q9). */
const AI_ONLY_DIR_PATHS = new Set(['docs/claude'])
const AI_ONLY_FILE_PATHS = new Set(['docs/journal.md'])
/** Consignes pour agents, où qu'elles soient. */
const AI_ONLY_FILE_NAMES = new Set(['claude.md', 'agents.md', 'gemini.md', 'skill.md', '.cursorrules'])

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

/** Dossier jamais parcouru, d'après son chemin relatif (`/`) : par son nom, ou par son chemin pour la doc IA. */
export function isExcludedDir(path: string): boolean {
  const lower = path.toLowerCase()
  return EXCLUDED_DIRS.has(lower.split('/').at(-1) ?? lower) || AI_ONLY_DIR_PATHS.has(lower)
}

const isAiOnlyFile = (path: string, name: string): boolean => {
  const lower = path.toLowerCase()
  return (
    AI_ONLY_FILE_NAMES.has(name) ||
    AI_ONLY_FILE_PATHS.has(lower) ||
    [...AI_ONLY_DIR_PATHS].some((dir) => lower.startsWith(`${dir}/`))
  )
}

/**
 * Sort d'un fichier du projet repris (`path` relatif, `/`) : retenu (avec son langage), sensible (jamais lu ni
 * montré), ignoré (binaire, dossier exclu, `.gitignore`) ou trop gros.
 */
export function classifyFile(path: string, size: number, ignored: (path: string) => boolean): FileVerdict {
  const segments = path.split('/')
  const name = segments.at(-1)?.toLowerCase() ?? ''
  if (isSecretFileName(name) || SENSITIVE_SETTINGS.test(name)) return { kind: 'sensitive' }
  const excludedDir = segments.slice(0, -1).some((segment) => EXCLUDED_DIRS.has(segment.toLowerCase()))
  if (excludedDir || isAiOnlyFile(path, name) || isBinaryFileName(name) || ignored(path)) return { kind: 'ignored' }
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
export function gitignoreMatcher(text: string): (path: string, isDirectory?: boolean) => boolean {
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
  return (path: string, isDirectory = false): boolean => {
    const segments = path.split('/')
    return rules.some((rule) => {
      for (let end = 1; end <= segments.length; end++) {
        const isFile = end === segments.length && !isDirectory
        if (rule.directory && isFile) continue
        const candidates = rule.anywhere ? [segments[end - 1] ?? ''] : [segments.slice(0, end).join('/')]
        if (candidates.some((candidate) => rule.regexp.test(candidate))) return true
      }
      return false
    })
  }
}
