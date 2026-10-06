/**
 * Langage d'un fichier du projet pour la coloration de la visionneuse (spec 013 D4) : nom de langage `highlight.js`
 * déduit de l'extension, `null` pour du texte brut.
 */
const BY_EXTENSION: Readonly<Record<string, string>> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  css: 'css',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  md: 'markdown',
  php: 'php',
  cs: 'csharp',
  cpp: 'cpp',
  cc: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  ps1: 'powershell'
}

/** Langages enregistrés dans la visionneuse (ensemble fermé : le reste s'affiche en texte brut). */
export const VIEWER_LANGUAGES = [...new Set(Object.values(BY_EXTENSION))]

export function languageOf(path: string): string | null {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null
  return BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null
}
