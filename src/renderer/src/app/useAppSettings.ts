import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { DEFAULT_APP_SETTINGS, type AppSettingsView } from '@shared/ipc/app'
import { call } from '../lib/ipc'

export const APP_SETTINGS_KEY = ['app', 'settings'] as const

export function useAppSettings(): UseQueryResult<AppSettingsView> {
  return useQuery({ queryKey: APP_SETTINGS_KEY, queryFn: () => call<AppSettingsView>('app:getSettings') })
}

/** Réglages effectifs : valeurs par défaut tant que le chargement n'a pas abouti (aucun écran bloqué). */
export function useEffectiveSettings(): AppSettingsView {
  return useAppSettings().data ?? DEFAULT_APP_SETTINGS
}
