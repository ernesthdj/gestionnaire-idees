import { ExplorerPage } from '../explorer/ExplorerPage'
import { useUiStore } from '../app/uiStore'
import { AnalyzeCodeForm, useCodeAnalysis } from '../reprise/AnalyzeCode'
import { StructureViewSwitch } from './nodes/StructureBarNode'
import { FoldPanelButton } from './PanelFold'

/**
 * Position « Architecture » d'une carte de projet lié (spec 032 D14) : l'explorateur en boîtes du projet (spec 031),
 * avec ses gestes, sa fiche, sa recherche et le détecteur d'architecture (D15), monté par-dessus la carte ; la bascule
 * des vues remplace « ← Carte ». Sans analyse du code, l'app propose de la lancer.
 */
export function ArchitectureView({ genesisId }: { readonly genesisId: string }): React.JSX.Element {
  const setStructureView = useUiStore((state) => state.setStructureView)
  const { target, notAnalyzed, loading } = useCodeAnalysis(genesisId)
  const switcher = (
    <>
      <StructureViewSwitch genesisId={genesisId} view="architecture" />
      <FoldPanelButton />
    </>
  )
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface">
      {target !== null ? (
        <ExplorerPage
          key={target}
          genesisId={target}
          switcher={switcher}
          onClose={() => setStructureView(genesisId, 'workflow')}
        />
      ) : (
        <section aria-label="Architecture du projet" className="flex h-full flex-col">
          <header className="flex items-center gap-3 border-b border-content-muted/20 px-4 py-2">{switcher}</header>
          <div className="flex flex-1 items-start justify-center p-8 text-sm">
            {loading ? (
              <p className="text-content-muted">Chargement…</p>
            ) : notAnalyzed ? (
              <div className="flex max-w-md flex-col gap-3">
                <h2 className="text-base font-semibold">Le code de ce projet n’est pas encore analysé</h2>
                <AnalyzeCodeForm genesisId={genesisId} onAnalyzed={() => undefined} />
              </div>
            ) : (
              <p role="alert" className="text-con">
                L’analyse du code de ce projet n’a pas pu être lue.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
