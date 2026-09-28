import { useSyncExternalStore } from 'react'
import type { MotionMode } from '@shared/ipc/app'
import { isReducedMotion } from './durations'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const systemPrefersReduced = (): boolean => window.matchMedia(QUERY).matches

/** Préférence effective : système (« Afficher les animations » de Windows) OU réglage de l'app, suivie en direct. */
export function useReducedMotionPreference(mode: MotionMode): boolean {
  return isReducedMotion(mode, useSyncExternalStore(subscribe, systemPrefersReduced))
}
