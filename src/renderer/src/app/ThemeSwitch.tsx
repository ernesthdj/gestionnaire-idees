import { useQueryClient } from '@tanstack/react-query'
import type { AppSettingsView, Theme } from '@shared/ipc/app'
import { call, IpcFailure } from '../lib/ipc'
import { useUiStore } from './uiStore'
import { APP_SETTINGS_KEY, useEffectiveSettings } from './useAppSettings'

const OPTIONS: ReadonlyArray<{ readonly theme: Theme; readonly label: string; readonly icon: string }> = [
  { theme: 'system', label: 'Thème du système', icon: '◐' },
  { theme: 'light', label: 'Thème clair', icon: '☀' },
  { theme: 'dark', label: 'Thème sombre', icon: '☾' }
]

/** Choix du thème (système, clair, sombre) : appliqué aussitôt, enregistré par le main. */
export function ThemeSwitch(): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const current = useEffectiveSettings().theme

  const choose = async (theme: Theme): Promise<void> => {
    if (theme === current) return
    try {
      client.setQueryData(APP_SETTINGS_KEY, await call<AppSettingsView>('app:setSettings', { theme }))
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'Le thème n’a pas pu être enregistré.')
    }
  }

  return (
    <div role="group" aria-label="Thème" className="flex rounded-md bg-surface-raised p-0.5">
      {OPTIONS.map(({ theme, label, icon }) => (
        <button
          key={theme}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={current === theme}
          onClick={() => void choose(theme)}
          className={`flex h-7 w-8 items-center justify-center rounded text-sm ${
            current === theme
              ? 'bg-surface font-semibold text-content shadow-sm'
              : 'text-content-muted hover:text-content'
          }`}
        >
          <span aria-hidden="true">{icon}</span>
        </button>
      ))}
    </div>
  )
}
