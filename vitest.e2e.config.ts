import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Tests de bout en bout (`npm run e2e`) : l'app construite (`out/`) lancée par Playwright sur un profil fictif
 * `gestionnaire-idees-e2e`, jamais le profil réel. Une app à la fois, délais longs. Le banc de mesure de la reprise
 * (5 000 fichiers, SC-004 / SC-005) se lance à part (`npm run e2e:bench`, mode `bench`) : enchaîné aux autres, sa
 * fenêtre est ralentie par Chromium et ses chronomètres mesurent ce ralentissement, pas l'app.
 */
const BENCH = 'tests/e2e/reprise-bench.e2e.ts'

export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@shared': resolve(import.meta.dirname, 'src/shared') } },
  test: {
    include: mode === 'bench' ? [BENCH] : ['tests/e2e/**/*.e2e.ts'],
    exclude: mode === 'bench' ? [] : [BENCH, '**/node_modules/**'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 120_000
  }
}))
