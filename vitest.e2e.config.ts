import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Tests de bout en bout (`npm run e2e`) : l'app construite (`out/`) lancée par Playwright sur un profil fictif
 * `gestionnaire-idees-e2e`, jamais le profil réel. Une app à la fois, délais longs.
 */
export default defineConfig({
  resolve: { alias: { '@shared': resolve(import.meta.dirname, 'src/shared') } },
  test: {
    include: ['tests/e2e/**/*.e2e.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 120_000
  }
})
