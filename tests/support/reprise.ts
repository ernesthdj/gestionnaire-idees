import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Engine } from '../../src/analysis-worker/engine'
import { extractFile } from '../../src/analysis-worker/extract'
import type { ResolveConfig, ResolveFile } from '../../src/main/domain/reprise/resolve'

export const REPRISE_FIXTURES = resolve(import.meta.dirname, '../fixtures/reprise')
export const GRAMMARS_DIR = resolve(import.meta.dirname, '../../node_modules/@vscode/tree-sitter-wasm/wasm')

const LANGS: Readonly<Record<string, ResolveFile['lang']>> = { ts: 'ts', tsx: 'tsx', js: 'js', cs: 'cs', php: 'php' }

function walk(root: string, relative = ''): string[] {
  return readdirSync(join(root, relative)).flatMap((name) => {
    const path = relative === '' ? name : `${relative}/${name}`
    return statSync(join(root, path)).isDirectory() ? walk(root, path) : [path]
  })
}

/** Fichiers analysables d'un projet de démonstration, extraits, avec des identifiants lisibles (`chemin#nom`). */
export function extractFixture(engine: Engine, project: string): ResolveFile[] {
  const root = join(REPRISE_FIXTURES, project)
  return walk(root).flatMap((path) => {
    const lang = LANGS[path.split('.').at(-1) ?? '']
    if (lang === undefined) return []
    const result = extractFile(engine, lang, readFileSync(join(root, path), 'utf8'))
    if (!result.ok) return []
    return [
      {
        path,
        lang,
        extraction: result.extraction,
        symbolIds: result.extraction.symbols.map((symbol) => `${path}#${symbol.qualifiedName}`),
        fileSymbolId: `${path}#<fichier>`
      }
    ]
  })
}

export const FIXTURE_CONFIG: ResolveConfig = {
  tsPaths: [{ pattern: '@core/*', targets: ['src/core/*'] }],
  psr4: [{ prefix: 'App\\', dir: 'app' }]
}
