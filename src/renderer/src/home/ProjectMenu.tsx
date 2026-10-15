import { useState } from 'react'
import { Icon } from '../app/Icon'
import { useUiStore } from '../app/uiStore'
import { usePopover } from '../app/usePopover'
import { Button } from '../components/atoms/Button'
import { SavePoints } from '../canvas/SavePoints'
import { AnalyzeCodeForm, useCodeAnalysis } from '../reprise/AnalyzeCode'
import { flushViewState } from './useBrainstorms'

/**
 * « Analyser le code… » tant que le dossier du projet n'est pas analysé (spec 017 D23), avec la confidentialité choisie
 * avant tout envoi (FR-003) ; ensuite, la carte du code est la vue Architecture (spec 033 D4).
 */
function AnalyzeEntry({ genesisId, onDone }: { readonly genesisId: string; readonly onDone: () => void }) {
  const setStructureView = useUiStore((state) => state.setStructureView)
  const [choosing, setChoosing] = useState(false)
  const { target, notAnalyzed } = useCodeAnalysis(genesisId)
  if (target !== null || !notAnalyzed) return null
  if (!choosing) {
    return (
      <Button variant="ghost" className="w-full text-left" onClick={() => setChoosing(true)}>
        Analyser le code…
      </Button>
    )
  }
  return (
    <section
      aria-label="Analyser le code du projet"
      className="flex flex-col gap-2 rounded-md bg-surface-raised p-3 text-xs"
    >
      <AnalyzeCodeForm
        genesisId={genesisId}
        onAnalyzed={() => {
          setChoosing(false)
          setStructureView(genesisId, 'architecture')
          onDone()
        }}
        onCancel={() => setChoosing(false)}
      />
    </section>
  )
}

/**
 * Le projet ouvert dans le fil de la barre fine (spec 033 D2, D3) : son nom ; le ▾ ouvre le retour aux projets, le
 * chemin du dossier, les points de sauvegarde et « Analyser le code… ».
 */
export function ProjectMenu(): React.JSX.Element | null {
  const brainstorm = useUiStore((state) => state.brainstorm)
  const show = useUiStore((state) => state.show)
  const popover = usePopover<HTMLDivElement>()
  if (brainstorm === null) return null
  return (
    <div ref={popover.ref} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={popover.open}
        aria-label={`Projet ${brainstorm.name} : menu`}
        onClick={popover.toggle}
        className={`flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-sm hover:bg-surface-raised ${popover.open ? 'bg-surface-raised' : ''}`}
      >
        <span aria-hidden="true" className="text-content-muted/60">
          /
        </span>
        <span className="truncate font-semibold">{brainstorm.name}</span>
        <Icon name="chevron" size={12} />
      </button>
      {popover.open ? (
        <section
          aria-label={`Projet ${brainstorm.name}`}
          className="absolute left-0 top-full z-40 mt-1 flex w-80 flex-col gap-1 rounded-xl bg-surface p-2 text-sm shadow-lg"
        >
          <Button
            variant="ghost"
            className="w-full text-left"
            onClick={() => {
              // La vue est écrite tout de suite (sans attendre le différé) : fermer l'app juste après ne la perd pas.
              void flushViewState()
              popover.close()
              show('home')
            }}
          >
            ← Tous les projets
          </Button>
          {brainstorm.folder === null ? null : (
            <p className="break-all px-2 py-1 font-mono text-[11px] text-content-muted">{brainstorm.folder}</p>
          )}
          <SavePoints brainstormId={brainstorm.id} asMenuItem />
          {brainstorm.genesisId === null || brainstorm.folder === null ? null : (
            <AnalyzeEntry genesisId={brainstorm.genesisId} onDone={popover.close} />
          )}
        </section>
      ) : null}
    </div>
  )
}
