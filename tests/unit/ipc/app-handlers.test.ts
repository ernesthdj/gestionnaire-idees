import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_APP_SETTINGS, type AppSettingsView } from '../../../src/shared/ipc/app'
import { createAppRoutes } from '../../../src/main/ipc/appHandlers'
import { createDispatcher } from '../../../src/main/ipc/registry'
import { GlobalShortcut, type ShortcutRegistry } from '../../../src/main/shell/GlobalShortcut'

function setup(taken: readonly string[] = []) {
  let stored: AppSettingsView = { ...DEFAULT_APP_SETTINGS }
  const registry: ShortcutRegistry = {
    register: vi.fn((accelerator: string) => !taken.includes(accelerator)),
    unregister: vi.fn()
  }
  const shortcut = new GlobalShortcut(registry, () => undefined)
  shortcut.replace(DEFAULT_APP_SETTINGS.shortcut)
  const applyLaunchAtLogin = vi.fn()
  const dispatch = createDispatcher(
    createAppRoutes({
      version: '0.1.0',
      settings: {
        get: () => stored,
        update: (patch) => (stored = { ...stored, ...patch })
      },
      replaceShortcut: (accelerator) => shortcut.replace(accelerator),
      applyLaunchAtLogin
    })
  )
  return { dispatch, shortcut, registry, applyLaunchAtLogin, stored: () => stored }
}

describe('canaux app:*', () => {
  it('should_save_theme_and_motion_when_valid', async () => {
    const { dispatch, stored } = setup()
    const result = await dispatch('app:setSettings', { theme: 'dark', motion: 'reduced' })
    expect(result).toMatchObject({ success: true, data: { theme: 'dark', motion: 'reduced' } })
    expect(stored().theme).toBe('dark')
  })

  it.each([{ theme: 'violet' }, { shortcut: 'Space' }, { onboardingDone: true }, { unknown: 1 }])(
    'should_refuse_invalid_or_foreign_field_%o',
    async (patch) => {
      const { dispatch, stored } = setup()
      expect(await dispatch('app:setSettings', patch)).toMatchObject({ success: false, error: { code: 'VALIDATION' } })
      expect(stored()).toEqual(DEFAULT_APP_SETTINGS)
    }
  )

  it('should_switch_the_global_shortcut_when_the_new_one_is_free', async () => {
    const { dispatch, shortcut, registry } = setup()
    const result = await dispatch('app:setSettings', { shortcut: 'Control+Shift+I' })
    expect(result).toMatchObject({ success: true, data: { shortcut: 'Control+Shift+I' } })
    expect(shortcut.active).toBe('Control+Shift+I')
    expect(registry.unregister).toHaveBeenCalledWith('Control+Alt+Space')
  })

  it('should_keep_the_old_shortcut_and_save_nothing_when_the_new_one_is_taken', async () => {
    const { dispatch, shortcut, stored } = setup(['Control+Shift+I'])
    const result = await dispatch('app:setSettings', { shortcut: 'Control+Shift+I', theme: 'dark' })
    expect(result).toMatchObject({ success: false, error: { code: 'SHORTCUT_UNAVAILABLE' } })
    expect(shortcut.active).toBe('Control+Alt+Space')
    expect(stored()).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('should_apply_launch_at_login_when_changed', async () => {
    const { dispatch, applyLaunchAtLogin } = setup()
    await dispatch('app:setSettings', { launchAtLogin: false })
    expect(applyLaunchAtLogin).toHaveBeenCalledWith(false)
  })

  it('should_mark_onboarding_done_when_completed', async () => {
    const { dispatch, stored } = setup()
    expect(await dispatch('app:completeOnboarding', undefined)).toEqual({ success: true, data: { ok: true } })
    expect(stored().onboardingDone).toBe(true)
  })
})
