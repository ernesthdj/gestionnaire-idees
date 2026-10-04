import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve(import.meta.dirname, 'src/shared')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        // Deux points d'entrée : le processus principal et le relais du pont MCP (spec 007), lancé par Claude Code.
        input: {
          index: resolve(import.meta.dirname, 'src/main/index.ts'),
          'mcp-relay': resolve(import.meta.dirname, 'src/mcp-relay/relay.ts')
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
