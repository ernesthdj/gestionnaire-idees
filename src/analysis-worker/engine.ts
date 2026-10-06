import { createRequire } from 'node:module'
import { join } from 'node:path'
import type * as TreeSitter from '@vscode/tree-sitter-wasm'

/** Langages analysés (spec 017 D2) et leur grammaire. */
export const GRAMMARS = {
  ts: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  js: 'tree-sitter-javascript.wasm',
  cs: 'tree-sitter-c-sharp.wasm',
  php: 'tree-sitter-php.wasm'
} as const
export type GrammarLang = keyof typeof GRAMMARS

export interface Engine {
  readonly parser: TreeSitter.Parser
  readonly languages: Readonly<Record<GrammarLang, TreeSitter.Language>>
  readonly module: typeof TreeSitter
}

/**
 * Charge le moteur d'analyse syntaxique et les grammaires depuis `grammarsDir` (spec 017 R1) : un dossier fixé par le
 * main (à côté du processus d'analyse, ou celui du paquet en test), jamais un chemin venu de l'interface.
 */
export async function loadEngine(grammarsDir: string): Promise<Engine> {
  // Le moteur est un module UMD livré avec ses .wasm : chargé depuis son dossier, pas embarqué dans le bundle.
  const module = createRequire(join(grammarsDir, 'tree-sitter.js'))('./tree-sitter.js') as typeof TreeSitter
  await module.Parser.init({ locateFile: (file: string) => join(grammarsDir, file) })
  const entries = await Promise.all(
    (Object.keys(GRAMMARS) as GrammarLang[]).map(
      async (lang) => [lang, await module.Language.load(join(grammarsDir, GRAMMARS[lang]))] as const
    )
  )
  return {
    parser: new module.Parser(),
    languages: Object.fromEntries(entries) as Record<GrammarLang, TreeSitter.Language>,
    module
  }
}
