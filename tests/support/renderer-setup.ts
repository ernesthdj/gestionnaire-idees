import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  // jsdom n'implémente pas matchMedia : préférences système neutres (pas d'animations réduites, thème clair).
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    })
  })
})

// Sans `globals`, Testing Library ne démonte pas les composants tout seul entre deux tests.
afterEach(() => {
  cleanup()
  delete document.documentElement.dataset['theme']
})
