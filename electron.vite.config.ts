import { copyFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve(import.meta.dirname, 'src/shared')

/** Moteur et grammaires de l'analyse syntaxique (spec 017 R1) : seuls les fichiers utiles, à côté du processus. */
const GRAMMAR_FILES = [
  'tree-sitter.js',
  'tree-sitter.wasm',
  'tree-sitter-typescript.wasm',
  'tree-sitter-tsx.wasm',
  'tree-sitter-javascript.wasm',
  'tree-sitter-c-sharp.wasm',
  'tree-sitter-php.wasm'
]

function copyGrammars(): Plugin {
  return {
    name: 'copy-grammars',
    writeBundle(options) {
      const source = resolve(import.meta.dirname, 'node_modules/@vscode/tree-sitter-wasm/wasm')
      const target = join(options.dir ?? resolve(import.meta.dirname, 'out/main'), 'grammars')
      mkdirSync(target, { recursive: true })
      for (const file of GRAMMAR_FILES) copyFileSync(join(source, file), join(target, file))
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyGrammars()],
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        // Trois points d'entrée : le processus principal, le relais du pont MCP (spec 007), lancé par Claude Code, et
        // le processus d'analyse des projets repris (spec 017 R2), lancé par le main.
        input: {
          index: resolve(import.meta.dirname, 'src/main/index.ts'),
          'mcp-relay': resolve(import.meta.dirname, 'src/mcp-relay/relay.ts'),
          'analysis-worker': resolve(import.meta.dirname, 'src/analysis-worker/worker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        // Un preload en sandbox doit être en CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@shared': shared, '@renderer': resolve(import.meta.dirname, 'src/renderer/src') } },
    build: {
      rollupOptions: {
        // Deux pages : fenêtre principale et fenêtre de capture.
        input: {
          index: resolve(import.meta.dirname, 'src/renderer/index.html'),
          capture: resolve(import.meta.dirname, 'src/renderer/capture.html')
        }
      }
    }
  }
})
