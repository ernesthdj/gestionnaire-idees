import { useUiStore } from '../app/uiStore'

/**
 * « Voir la carte » (spec 032, 2026-10-14) : replie le panneau Progression ou Architecture pour montrer la carte dessous
 * (carte de structure de Claude et ses statuts, spec 030 ; blocs de la vue, spec 023 D25). Rien n'est perdu.
 */
export function FoldPanelButton(): React.JSX.Element {
  const foldPanel = useUiStore((state) => state.foldPanel)
  return (
    <button
      type="button"
      onClick={() => foldPanel(true)}
      title="Replier ce panneau pour voir la carte dessous (carte de structure, widgets de la vue)"
      className="h-7 shrink-0 whitespace-nowrap rounded-md border border-content-muted/40 px-2 text-xs hover:bg-surface-raised"
    >
      ▾ Voir la carte
    </button>
  )
}
