import type { LicenseView } from './license'

/**
 * En-tête d'attribution d'un morceau extrait (spec 021 US7, FR-036) : origine, chemin, commit, licence, copyright,
 * écrit dans la syntaxe de commentaire du fichier ; et la note d'étude, quand la licence ne permet pas la copie. Pur.
 */

export interface ExtractOrigin {
  /** Dépôt d'origine, sans identifiant (`owner/nom` ou adresse affichable). */
  readonly origin: string
  readonly path: string
  readonly commit: string
  readonly lines: { readonly from: number; readonly to: number } | null
  readonly license: LicenseView
  readonly date: string
}

type Style =
  | { readonly kind: 'line'; readonly mark: string }
  | { readonly kind: 'block'; readonly open: string; readonly close: string }

const LINE = (mark: string): Style => ({ kind: 'line', mark })
const STYLES: Readonly<Record<string, Style>> = {
  ts: LINE('//'),
  tsx: LINE('//'),
  js: LINE('//'),
  jsx: LINE('//'),
  mjs: LINE('//'),
  cjs: LINE('//'),
  cs: LINE('//'),
  java: LINE('//'),
  kt: LINE('//'),
  go: LINE('//'),
  rs: LINE('//'),
  c: LINE('//'),
  h: LINE('//'),
  cpp: LINE('//'),
  hpp: LINE('//'),
  swift: LINE('//'),
  php: LINE('//'),
  py: LINE('#'),
  rb: LINE('#'),
  sh: LINE('#'),
  ps1: LINE('#'),
  yml: LINE('#'),
  yaml: LINE('#'),
  toml: LINE('#'),
  r: LINE('#'),
  sql: LINE('--'),
  lua: LINE('--'),
  css: { kind: 'block', open: '/*', close: '*/' },
  scss: LINE('//'),
  md: { kind: 'block', open: '<!--', close: '-->' },
  html: { kind: 'block', open: '<!--', close: '-->' },
  xml: { kind: 'block', open: '<!--', close: '-->' },
  vue: { kind: 'block', open: '<!--', close: '-->' }
}

const extensionOf = (name: string): string => (name.includes('.') ? (name.split('.').at(-1) ?? '').toLowerCase() : '')

/** Fichier dont on sait écrire l'en-tête : sinon, seule la note d'étude est possible (en-tête impossible à garantir). */
export const canAttribute = (name: string): boolean => Object.hasOwn(STYLES, extensionOf(name))

function lines(info: ExtractOrigin): string[] {
  const where = info.lines === null ? info.path : `${info.path}, lignes ${info.lines.from} à ${info.lines.to}`
  return [
    `Extrait de ${info.origin} — ${where}`,
    `Commit ${info.commit.slice(0, 12)}, copié le ${info.date.slice(0, 10)}`,
    `Licence : ${info.license.spdx ?? 'inconnue'}${info.license.verdict === 'reciprocite' ? ' (réciprocité : même licence pour le code qui l’intègre)' : ''}`,
    ...(info.license.copyright === null ? [] : [info.license.copyright])
  ].map((line) => line.replace(/\*\/|-->/g, '').replace(/[\r\n]+/g, ' '))
}

export function attributionHeader(fileName: string, info: ExtractOrigin): string {
  const style = STYLES[extensionOf(fileName)]
  if (style === undefined) throw new Error(`en-tête impossible pour ${fileName}`)
  const body = lines(info)
  return style.kind === 'line'
    ? `${body.map((line) => `${style.mark} ${line}`).join('\n')}\n\n`
    : `${style.open}\n${body.map((line) => `  ${line}`).join('\n')}\n${style.close}\n\n`
}

/** Note d'étude (licence inconnue) : l'origine et la place pour comprendre, jamais le code copié. */
export function studyNote(info: ExtractOrigin): string {
  return [
    `# Note d’étude — ${info.path.split('/').at(-1) ?? info.path}`,
    '',
    ...lines(info).map((line) => `- ${line}`),
    '',
    '> Licence inconnue ou absente : le code n’est pas copié. Décris ici ce que tu en retiens (idée, structure, piège),',
    '> avec tes mots.',
    '',
    '## Ce que fait ce code',
    '',
    '## Ce que j’en retiens',
    ''
  ].join('\n')
}
