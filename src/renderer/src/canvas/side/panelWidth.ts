import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAT_PANEL_WIDTH, type AppSettingsView } from '@shared/ipc/app'
import { APP_SETTINGS_KEY, useEffectiveSettings } from '../../app/useAppSettings'
import { useUiStore } from '../../app/uiStore'
import { call, IpcFailure } from '../../lib/ipc'

/** Délai sans touche ←/→ avant d'enregistrer la largeur (spec 027 R8) : une seule écriture pour une suite de pas. */
export const WIDTH_SAVE_DELAY_MS = 400
/** Sous cette largeur de fenêtre, le panneau passe par-dessus la carte (spec 027 R10). */
export const NARROW_WINDOW_PX = 1100

/** Largeur bornée et entière (25 à 55 %). */
export function clampWidth(percent: number): number {
  return Math.min(CHAT_PANEL_WIDTH.max, Math.max(CHAT_PANEL_WIDTH.min, Math.round(percent)))
}

/** Largeur d'après la poignée : la distance du pointeur au bord droit de la zone, en % de la zone. */
export function widthAt(pointerX: number, area: { readonly left: number; readonly width: number }): number {
  return area.width <= 0
    ? CHAT_PANEL_WIDTH.default
    : clampWidth(((area.left + area.width - pointerX) / area.width) * 100)
}

/** Pas clavier de la poignée (bord gauche du panneau) : ← élargit, → resserre ; Début / Fin vont aux bornes. */
export function widthAfterKey(key: string, current: number): number | null {
  if (key === 'ArrowLeft') return clampWidth(current + CHAT_PANEL_WIDTH.step)
  if (key === 'ArrowRight') return clampWidth(current - CHAT_PANEL_WIDTH.step)
  if (key === 'Home') return CHAT_PANEL_WIDTH.min
  if (key === 'End') return CHAT_PANEL_WIDTH.max
  return null
}

/** Fenêtre étroite (moins de 1 100 px) : suit le redimensionnement. */
export function useNarrowWindow(): boolean {
  const query = `(max-width: ${NARROW_WINDOW_PX - 1}px)`
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const change = (): void => setNarrow(list.matches)
    list.addEventListener('change', change)
    change()
    return () => list.removeEventListener('change', change)
  }, [query])
  return narrow
}

/**
 * Largeur du panneau (spec 027 D6) : lue dans les réglages de l'app, suivie en direct pendant un réglage, enregistrée
 * au lâcher de la poignée ou après une suite de touches (canal `app:setSettings`, validé par le main).
 */
export function usePanelWidth(): {
  readonly width: number
  readonly preview: (percent: number) => void
  readonly commit: (percent: number, delayed?: boolean) => void
} {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const saved = useEffectiveSettings().chatPanelWidth
  const [draft, setDraft] = useState<number | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const save = useCallback(
    async (percent: number): Promise<void> => {
      try {
        client.setQueryData(
          APP_SETTINGS_KEY,
          await call<AppSettingsView>('app:setSettings', { chatPanelWidth: percent })
        )
      } catch (error) {
        showToast(error instanceof IpcFailure ? error.message : 'La largeur du panneau n’a pas pu être enregistrée.')
      } finally {
        setDraft(null)
      }
    },
    [client, showToast]
  )
  const preview = useCallback((percent: number) => setDraft(clampWidth(percent)), [])
  const commit = useCallback(
    (percent: number, delayed = false) => {
      const next = clampWidth(percent)
      setDraft(next)
      window.clearTimeout(timer.current)
      if (delayed) timer.current = window.setTimeout(() => void save(next), WIDTH_SAVE_DELAY_MS)
      else void save(next)
    },
    [save]
  )
  return { width: draft ?? saved, preview, commit }
}
