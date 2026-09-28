import { useState } from 'react'
import { AiSettingsPage } from './settings/ai/AiSettingsPage'
import { ContextPage } from './settings/ai/ContextPage'

const TABS = [
  { id: 'ai', label: 'IA' },
  { id: 'context', label: 'Contexte IA' }
] as const
type TabId = (typeof TABS)[number]['id']

/** Réglages (⚙) : IA et contexte (feature 001) ; les réglages généraux de l'app arrivent avec T043. */
export function SettingsPage(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('ai')
  return (
    <div className="h-full overflow-auto">
      <nav aria-label="Réglages" className="flex justify-center gap-2 border-b border-content-muted/20 p-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-current={tab === entry.id ? 'page' : undefined}
            onClick={() => setTab(entry.id)}
            className={`h-8 rounded-md px-4 text-sm ${tab === entry.id ? 'bg-surface-raised font-semibold' : 'text-content-muted'}`}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      {tab === 'ai' ? <AiSettingsPage /> : <ContextPage />}
    </div>
  )
}
