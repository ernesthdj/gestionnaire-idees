import { AiSettingsPage } from './pages/settings/ai/AiSettingsPage'

/** Coquille provisoire : la navigation complète arrive avec la spec 003 (interface MVP-1). */
export function App(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-surface text-content">
      <AiSettingsPage />
    </div>
  )
}
