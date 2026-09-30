import { useState } from 'react'
import type { WidgetCodeView } from '@shared/ipc/widgets'

const CODE_TABS = [
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['ts', 'TypeScript']
] as const

/** Code d'une version de widget, lu comme du TEXTE (jamais interprété dans l'app) : onglet « Code » et revue. */
export function CodeView({ code }: { readonly code: WidgetCodeView }): React.JSX.Element {
  const [tab, setTab] = useState<(typeof CODE_TABS)[number][0]>('ts')
  return (
    <div className="nodrag nowheel flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label="Parties du code"
        className="flex gap-1 border-b border-content-muted/20 px-2 py-1"
      >
        {CODE_TABS.map(([part, label]) => (
          <button
            key={part}
            type="button"
            role="tab"
            aria-selected={tab === part}
            onClick={() => setTab(part)}
            className={`rounded px-2 py-0.5 text-xs ${tab === part ? 'bg-surface-raised font-semibold' : 'text-content-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <pre
        role="tabpanel"
        tabIndex={0}
        aria-label={`Code ${tab}`}
        className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px] leading-snug whitespace-pre"
      >
        {code[tab]}
      </pre>
    </div>
  )
}
