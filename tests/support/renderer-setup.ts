import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sans `globals`, Testing Library ne démonte pas les composants tout seul entre deux tests.
afterEach(() => {
  cleanup()
})
