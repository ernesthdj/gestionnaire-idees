import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../src/main/domain/errors'
import { createSkillsRoutes } from '../../../src/main/ipc/skillsHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'

describe('canaux de l’arbre de skills (spec 020 T009)', () => {
  const view = { skills: [], links: [], scannedAt: 1 }
  const inventory = {
    refresh: vi.fn(() => view),
    watch: vi.fn(),
    get: vi.fn((skillId: string) => {
      if (skillId !== 'perso:hub') throw new AppError('NOT_FOUND', 'Skill introuvable')
      return { skill: {} as never, markdown: '# hub', files: [], filesTruncated: false }
    })
  }
  const dispatch = createDispatcher(createSkillsRoutes({ inventory }))

  it('should_refresh_the_inventory_and_rearm_the_watch_when_the_page_lists_skills', async () => {
    expect(await dispatch('skills:list', undefined)).toEqual({ success: true, data: view })
    expect(inventory.refresh).toHaveBeenCalledTimes(1)
    expect(inventory.watch).toHaveBeenCalledTimes(1)
    expect((await dispatch('skills:list', { path: 'C:/x' })).success).toBe(false)
  })

  it('should_return_a_skill_by_id_and_refuse_paths_or_unknown_ids', async () => {
    expect(await dispatch('skills:get', { skillId: 'perso:hub' })).toMatchObject({ success: true })
    expect(await dispatch('skills:get', { skillId: 'perso:inconnu' })).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' }
    })
    expect((await dispatch('skills:get', { skillId: 'perso:hub', path: '../x' })).success).toBe(false)
    expect((await dispatch('skills:get', {})).success).toBe(false)
  })
})
