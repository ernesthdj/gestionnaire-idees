import { describe, expect, it } from 'vitest'
import type { CanvasNeuronView } from '../../../src/shared/ipc/canvas'
import { projectGenesisOf } from '../../../src/renderer/src/canvas/projectGenesis'

const idea = (id: string, state: CanvasNeuronView['state'], linkedProject?: boolean): CanvasNeuronView =>
  ({ id, state, ...(linkedProject === undefined ? {} : { linkedProject }) }) as unknown as CanvasNeuronView

describe('genesis où « Recentrer » ramène la vue (spec 024 D20)', () => {
  it('should_prefer_the_genesis_linked_to_the_project_folder', () => {
    expect(projectGenesisOf([idea('a', 'hatched'), idea('b', 'raw', true)])?.id).toBe('b')
  })

  it('should_fall_back_to_the_first_hatched_then_the_first_idea_then_nothing', () => {
    expect(projectGenesisOf([idea('a', 'raw'), idea('b', 'hatched')])?.id).toBe('b')
    expect(projectGenesisOf([idea('a', 'raw'), idea('b', 'developing')])?.id).toBe('a')
    expect(projectGenesisOf([])).toBeNull()
  })
})
