import { MotionConfig } from 'motion/react'
import { AnalystePage } from '../analyste/AnalystePage'
import { useAnalysteStatus, useProbe } from '../analyste/useAnalysteStatus'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { HistoryPage } from '../pages/HistoryPage'
import { IdeasPage } from '../pages/IdeasPage'
import { ProjectManager } from '../home/ProjectManager'
import { useActiveBrainstormHydration, useViewStateSync } from '../home/useBrainstorms'
import { useRunEvents } from '../run/runStore'
import { SectionPlaceholder } from '../pages/SectionPlaceholder'
import { SettingsPage } from '../pages/SettingsPage'
import { SkillsPage } from '../skills/SkillsPage'
import { RepoBadge } from '../git/RepoBadge'
import { ProjectMenu } from '../home/ProjectMenu'
import { HeaderUsage } from './HeaderUsage'
import { Rail, type RailEntry } from './Rail'
import { Toast } from './Toast'
import { useUiStore, type View } from './uiStore'
import { useEffectiveSettings } from './useAppSettings'
import { useMappingWatch } from '../canvas/mapping/mappingStore'
import { useApplyTheme } from './useApplyTheme'
import { useMainEvents } from './useMainEvents'

const NAVIGATION: readonly RailEntry[] = [
  { section: 'home', label: 'Projets', icon: 'projects' },
  { section: 'ideas', label: 'Idées', icon: 'ideas' },
  { section: 'pending', label: 'À valider', icon: 'pending' },
  { section: 'history', label: 'Historique', icon: 'history' },
  { section: 'skills', label: 'Skills', icon: 'skills' },
  { section: 'analyste', label: 'Analyste', icon: 'analyste' }
]

const TITLES: Readonly<Record<View, string>> = {
  home: 'Projets',
  ideas: 'Idées',
  pending: 'À valider',
  history: 'Historique',
  skills: 'Skills',
  analyste: 'Analyste',
  settings: 'Réglages'
}

function CurrentView({
  view,
  hasBrainstorm
}: {
  readonly view: View
  readonly hasBrainstorm: boolean
}): React.JSX.Element {
  switch (view) {
    case 'settings':
      return <SettingsPage />
    case 'home':
      return <ProjectManager />
    case 'ideas':
      // Pas de canevas avant le choix d'un brainstorm (spec 024 D5).
      return hasBrainstorm ? <IdeasPage /> : <ProjectManager />
    case 'pending':
      return <SectionPlaceholder text="Les suggestions de liens et les synthèses en attente apparaîtront ici." />
    case 'history':
      return <HistoryPage />
    case 'skills':
      return <SkillsPage />
    case 'analyste':
      return <AnalystePage />
  }
}

/**
 * Coquille de la fenêtre principale (FR-002, spec 033) : le rail de 48 px à gauche (sections, thème, réglages), une
 * barre fine de 32 px (fil « section / projet ▾ », pastille git, consommation Claude) ; thème et préférence
 * d'animations appliqués à toute l'interface. Tout le reste est à la carte.
 */
export function AppShell(): React.JSX.Element {
  const settings = useEffectiveSettings()
  const reduced = useReducedMotionPreference(settings.motion)
  const view = useUiStore((state) => state.view)
  const show = useUiStore((state) => state.show)
  const brainstorm = useUiStore((state) => state.brainstorm)
  const hasBrainstorm = brainstorm !== null
  useApplyTheme(settings.theme)
  useMainEvents()
  useViewStateSync()
  useActiveBrainstormHydration()
  // Projets lancés (spec 025) : sortie et état suivis partout dans l'app.
  useRunEvents()
  useProbe()
  // Fin des cartographies de projet suivie partout dans l'app (spec 022).
  useMappingWatch()
  // L'entrée Analyste n'apparaît que lorsque la sonde est active (spec 019 FR-022).
  const analysteActive = useAnalysteStatus()?.active === true
  const navigation = NAVIGATION.filter(({ section }) => section !== 'analyste' || analysteActive || view === 'analyste')

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <div className="flex h-screen bg-surface text-content" data-reduced-motion={reduced}>
        <Rail entries={navigation} view={view} onShow={show} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-8 shrink-0 items-center gap-2 border-b border-content-muted/20 pl-3 pr-2">
            <h1 className="shrink-0 text-sm font-semibold">{TITLES[view]}</h1>
            {view === 'ideas' ? <ProjectMenu /> : null}
            {view === 'ideas' && brainstorm?.genesisId != null && brainstorm.folder !== null ? (
              <RepoBadge genesisId={brainstorm.genesisId} variant="chip" />
            ) : null}
            <span className="flex-1" />
            <HeaderUsage compact />
          </header>
          <main className="min-h-0 flex-1 overflow-hidden">
            <CurrentView view={view} hasBrainstorm={hasBrainstorm} />
          </main>
          <Toast />
        </div>
      </div>
    </MotionConfig>
  )
}
