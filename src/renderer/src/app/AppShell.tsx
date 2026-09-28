import { MotionConfig } from 'motion/react'
import type { Section } from '@shared/ipc/app'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { IdeasPage } from '../pages/IdeasPage'
import { SectionPlaceholder } from '../pages/SectionPlaceholder'
import { SettingsPage } from '../pages/SettingsPage'
import { Toast } from './Toast'
import { useUiStore, type View } from './uiStore'
import { useEffectiveSettings } from './useAppSettings'
import { useApplyTheme } from './useApplyTheme'
import { useMainEvents } from './useMainEvents'

const NAVIGATION: ReadonlyArray<{ readonly section: Section; readonly label: string }> = [
  { section: 'ideas', label: 'Idées' },
  { section: 'pending', label: 'À valider' },
  { section: 'history', label: 'Historique' }
]

const TITLES: Readonly<Record<View, string>> = {
  ideas: 'Idées',
  pending: 'À valider',
  history: 'Historique',
  settings: 'Réglages'
}

function CurrentView({ view }: { readonly view: View }): React.JSX.Element {
  switch (view) {
    case 'settings':
      return <SettingsPage />
    case 'ideas':
      return <IdeasPage />
    case 'pending':
      return <SectionPlaceholder text="Les suggestions de liens et les synthèses en attente apparaîtront ici." />
    case 'history':
      return <SectionPlaceholder text="L'historique des changements, avec annulation, apparaîtra ici." />
  }
}

/**
 * Coquille de la fenêtre principale (FR-002) : navigation à gauche, réglages ⚙ en haut à droite, thème et
 * préférence d'animations appliqués à toute l'interface.
 */
export function AppShell(): React.JSX.Element {
  const settings = useEffectiveSettings()
  const reduced = useReducedMotionPreference(settings.motion)
  const view = useUiStore((state) => state.view)
  const show = useUiStore((state) => state.show)
  useApplyTheme(settings.theme)
  useMainEvents()

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className="flex h-screen bg-surface text-content" data-reduced-motion={reduced}>
        <nav aria-label="Navigation principale" className="flex w-56 shrink-0 flex-col gap-4 bg-surface-raised p-4">
          <p className="px-2 text-sm font-semibold text-content-muted">Brainstormer</p>
          <ul className="flex flex-col gap-1">
            {NAVIGATION.map(({ section, label }) => (
              <li key={section}>
                <button
                  type="button"
                  aria-current={view === section ? 'page' : undefined}
                  onClick={() => show(section)}
                  className={`h-10 w-full rounded-md px-2 text-left text-sm transition-colors duration-150 ${
                    view === section ? 'bg-surface font-semibold' : 'text-content-muted hover:bg-surface'
                  }`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-content-muted/20 px-4">
            <h1 className="text-base font-semibold">{TITLES[view]}</h1>
            <button
              type="button"
              aria-label="Réglages"
              aria-current={view === 'settings' ? 'page' : undefined}
              onClick={() => show('settings')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-content-muted hover:bg-surface-raised"
            >
              <span aria-hidden="true">⚙</span>
            </button>
          </header>
          <main className="min-h-0 flex-1 overflow-hidden">
            <CurrentView view={view} />
          </main>
          <Toast />
        </div>
      </div>
    </MotionConfig>
  )
}
