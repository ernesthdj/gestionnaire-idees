import { useEffect } from 'react'
import type { Theme } from '@shared/ipc/app'

/** Thème sur `<html data-theme>` (tokens.css) ; sans attribut, la préférence système s'applique. */
export function useApplyTheme(theme: Theme): void {
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset['theme']
    else root.dataset['theme'] = theme
  }, [theme])
}
