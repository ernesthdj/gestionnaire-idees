import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import type { SettingField, SettingValue, SettingValues, WidgetSettingValuesView } from '@shared/widgets/settings'
import { useUiStore } from '../app/uiStore'
import { call, IpcFailure } from '../lib/ipc'
import { createThrottle } from './emitThrottle'

/** Valeurs des réglages d'un widget (spec 026 D7) : partagées par son cadre isolé et son panneau. */
export const widgetSettingsKey = (widgetBlockId: string): readonly string[] => ['widgetSettings', widgetBlockId]

const NO_FIELDS: readonly SettingField[] = []

export interface WidgetSettingsActions {
  /** `undefined` tant que les valeurs ne sont pas lues ; `null` si le widget n'a rien déclaré. */
  readonly values: SettingValues | null | undefined
  /** Réglages déclarés (vide tant que rien n'est déclaré). */
  readonly fields: readonly SettingField[]
  change(key: string, value: SettingValue): void
  reset(): void
}

/**
 * Réglages d'un widget : un changement s'affiche tout de suite (cache partagé, le cadre isolé le reçoit aussitôt) et
 * part au main regroupé ; le main renvoie les valeurs ramenées à la déclaration, qui remplacent celles du cache.
 */
export function useWidgetSettings(widgetBlockId: string, enabled = true): WidgetSettingsActions {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const query = useQuery({
    queryKey: widgetSettingsKey(widgetBlockId),
    queryFn: () => call<WidgetSettingValuesView>('widgetIo:settingsValues', { blockId: widgetBlockId }),
    enabled,
    staleTime: Infinity
  })

  // La réponse du main ne remplace le cache que sur demande : pendant une frappe, elle ramènerait une valeur ancienne.
  const save = useCallback(
    (values: SettingValues, apply = false): void => {
      void call<WidgetSettingValuesView>('widgetIo:setSettings', { blockId: widgetBlockId, values })
        .then((saved) => {
          if (apply) client.setQueryData(widgetSettingsKey(widgetBlockId), saved)
        })
        .catch((error: unknown) =>
          showToast(error instanceof IpcFailure ? error.message : 'Le réglage n’a pas pu être enregistré.')
        )
    },
    [client, showToast, widgetBlockId]
  )
  const throttle = useMemo(() => createThrottle((values: SettingValues) => save(values), 300), [save])
  useEffect(() => () => throttle.flush(), [throttle])

  const values = query.data?.values
  const change = useCallback(
    (key: string, value: SettingValue): void => {
      const current = client.getQueryData<WidgetSettingValuesView>(widgetSettingsKey(widgetBlockId))
      const next = { ...(current?.values ?? {}), [key]: value }
      client.setQueryData(widgetSettingsKey(widgetBlockId), { fields: current?.fields ?? [], values: next })
      throttle.push(next)
    },
    [client, throttle, widgetBlockId]
  )
  // Rien d'envoyé : le main ramène chaque réglage à sa valeur par défaut.
  const reset = useCallback((): void => {
    throttle.cancel()
    save({}, true)
  }, [save, throttle])

  return { values, fields: query.data?.fields ?? NO_FIELDS, change, reset }
}
