import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const RENDERER_TESTS = 'tests/unit/renderer/**/*.test.{ts,tsx}'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(import.meta.dirname, 'src/shared'),
      '@renderer': resolve(import.meta.dirname, 'src/renderer/src')
    }
  },
  test: {
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: { name: 'node', include: ['tests/**/*.test.{ts,tsx}'], exclude: [RENDERER_TESTS], environment: 'node' }
      },
      {
        // Composants de l'interface : DOM simulé (jsdom), nettoyage entre les tests.
        extends: true,
        test: {
          name: 'renderer',
          include: [RENDERER_TESTS],
          environment: 'jsdom',
          setupFiles: ['tests/support/renderer-setup.ts']
        }
      }
    ]
  }
})
