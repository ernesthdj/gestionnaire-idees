/** Ce qui existe dans un projet analysé : seules sources qu'un guide peut citer (spec 017 FR-029, SC-007). */
export interface KnownSources {
  readonly files: ReadonlySet<string>
  readonly dirs: ReadonlySet<string>
  readonly modules: ReadonlySet<string>
  /** Noms (simples et qualifiés) des symboles, par fichier. */
  readonly symbolsByFile: ReadonlyMap<string, ReadonlySet<string>>
  readonly symbolNames: ReadonlySet<string>
}

export function knownSources(
  files: readonly string[],
  moduleKeys: readonly string[],
  symbols: readonly { readonly path: string; readonly name: string; readonly qualifiedName: string }[]
): KnownSources {
  const dirs = new Set<string>()
  for (const file of files) {
    const parts = file.split('/')
    for (let end = 1; end < parts.length; end++) dirs.add(parts.slice(0, end).join('/'))
  }
  const symbolsByFile = new Map<string, Set<string>>()
  const symbolNames = new Set<string>()
  for (const symbol of symbols) {
    const names = symbolsByFile.get(symbol.path) ?? new Set<string>()
    names.add(symbol.name).add(symbol.qualifiedName)
    symbolsByFile.set(symbol.path, names)
    symbolNames.add(symbol.name).add(symbol.qualifiedName)
  }
  return { files: new Set(files), dirs, modules: new Set(moduleKeys), symbolsByFile, symbolNames }
}

/** Chemin tel qu'écrit par un modèle → forme relative `a/b.ts` (sans `./`, `\`, numéro de ligne ni `/` final). */
function normalizePath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+|^\/+/, '')
    .replace(/(#L\d+(-L?\d+)?|:\d+(-\d+)?)$/, '')
    .replace(/\/+$/, '')
}

/**
 * Source citée par le guide : sa forme normalisée si elle existe dans le projet (fichier, dossier, clé de module,
 * `fichier#symbole` ou nom de symbole), sinon `null` (retirée et signalée).
 */
export function checkSource(raw: string, known: KnownSources): string | null {
  const text = raw.trim().replace(/^`|`$/g, '').trim()
  if (text === '') return null
  if (known.modules.has(text)) return text
  const hash = text.lastIndexOf('#')
  const symbolPart = hash > 0 && !/^#L\d/.test(text.slice(hash)) ? text.slice(hash + 1) : undefined
  const path = normalizePath(symbolPart === undefined ? text : text.slice(0, hash))
  if (symbolPart !== undefined) {
    return known.symbolsByFile.get(path)?.has(symbolPart) === true ? `${path}#${symbolPart}` : null
  }
  if (known.files.has(path) || known.dirs.has(path)) return path
  if (!path.includes('/') && known.symbolNames.has(path.replace(/\(\)$/, ''))) return path.replace(/\(\)$/, '')
  return null
}
