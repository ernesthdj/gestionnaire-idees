import { useState } from 'react'
import { AiSettingsPage } from './settings/ai/AiSettingsPage'
import { AnalysteSettings } from './settings/AnalysteSettings'
import { ContextPage } from './settings/ai/ContextPage'
import { ClaudeCodeSettings } from './settings/claude/ClaudeCodeSettings'
import { EditorSettings } from './settings/EditorSettings'
import { ProjectSettings } from './settings/ProjectSettings'

const TABS = [
  { id: 'ai', label: 'IA' },
  { id: 'context', label: 'Contexte IA' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'editor', label: 'Éditeur' },
  { id: 'projects', label: 'Projets' },
  { id: 'analyste', label: 'Analyste' }
] as const
type TabId = (typeof TABS)[number]['id']

/** Réglages (⚙) : IA et contexte (feature 001), pont Claude Code (spec 007), éditeur (spec 013 D4), projets (spec 016), Analyste (spec 019) ; réglages généraux avec T043. */
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
      {tab === 'ai' ? (
        <AiSettingsPage />
      ) : tab === 'context' ? (
        <ContextPage />
      ) : tab === 'editor' ? (
        <EditorSettings />
      ) : tab === 'projects' ? (
        <ProjectSettings />
      ) : tab === 'analyste' ? (
        <AnalysteSettings />
      ) : (
        <ClaudeCodeSettings />
      )}
    </div>
  )
}
