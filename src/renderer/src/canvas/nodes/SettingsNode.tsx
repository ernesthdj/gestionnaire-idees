import { useQuery } from '@tanstack/react-query'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { BLOCK_LIMITS } from '@shared/ipc/canvas'
import type { WidgetSettingsView } from '@shared/widgets/settings'
import { call } from '../../lib/ipc'
import { SettingsForm } from '../../widgets/SettingsForm'
import { useWidgetSettings } from '../../widgets/useWidgetSettings'
import type { SettingsNodeType } from '../buildGraph'
import { useBlockActions } from '../useBlockActions'

const LIMITS = BLOCK_LIMITS.settings

export const settingsPanelKey = (panelBlockId: string): readonly string[] => ['widgetSettingsPanel', panelBlockId]

/**
 * Panneau de réglages flottant d'un widget (spec 026 D7) : posé à sa droite, relié par un trait, dessiné par
 * l'application à partir de la déclaration du widget. Chaque changement arrive aussitôt dans le widget. Il se
 * déplace, se redimensionne et se supprime comme tout bloc ; la prochaine déclaration du widget le recrée.
 */
export function SettingsNode({ id, selected }: NodeProps<SettingsNodeType>): React.JSX.Element {
  const blockActions = useBlockActions()
  const panel = useQuery({
    queryKey: settingsPanelKey(id),
    queryFn: () => call<WidgetSettingsView>('widgetIo:settings', { blockId: id })
  })
  const view = panel.data
  const settings = useWidgetSettings(view?.widgetBlockId ?? '', view !== undefined)
  const title = view?.widgetTitle === null || view === undefined ? 'Réglages' : `Réglages · ${view.widgetTitle}`

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={LIMITS.minWidth}
        minHeight={LIMITS.minHeight}
        maxWidth={LIMITS.maxWidth}
        maxHeight={LIMITS.maxHeight}
        onResizeEnd={(_event, box) => void blockActions.save(id, box)}
      />
      <section
        aria-label={title}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-accent/60 bg-surface text-content shadow-lg"
      >
        <header className="flex h-8 shrink-0 cursor-grab items-center gap-1 border-b border-content-muted/20 bg-surface-raised px-2 text-xs active:cursor-grabbing">
          <span aria-hidden="true">⚙</span>
          <span className="flex-1 truncate font-semibold">{title}</span>
          <button
            type="button"
            aria-label="Supprimer le panneau de réglages"
            title="Supprimer (le widget le recrée à sa prochaine ouverture)"
            onClick={() => void blockActions.remove(id, 'settings')}
            className="nodrag flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface"
          >
            ×
          </button>
        </header>
        <div className="nodrag nowheel min-h-0 flex-1 overflow-y-auto">
          {panel.isError ? (
            <p className="p-4 text-center text-xs text-content-muted">Ces réglages n’ont pas pu être chargés.</p>
          ) : view === undefined ? null : (
            <SettingsForm
              fields={view.fields}
              values={settings.values ?? view.values}
              onChange={settings.change}
              onReset={settings.reset}
            />
          )}
        </div>
      </section>
    </>
  )
}
