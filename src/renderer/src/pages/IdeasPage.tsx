import { useEffect } from 'react'
import { useUiStore } from '../app/uiStore'
import { IdeasCanvas } from '../canvas/IdeasCanvas'
import { useCards } from '../canvas/cards/cardsStore'
import { RepoPanel } from '../git/RepoPanel'

/**
 * Écran Idées : la carte, et à droite le volet Dépôt d'un projet quand il est ouvert (spec 021, 62 / 38).
 * `Ctrl+Maj+G` ouvre ou ferme le volet du genesis dont la carte est active.
 */
export function IdeasPage(): React.JSX.Element {
  const repoGenesisId = useUiStore((state) => state.repoGenesisId)
  const openRepo = useUiStore((state) => state.openRepo)
  const closeRepo = useUiStore((state) => state.closeRepo)
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'g')) return
      event.preventDefault()
      if (useUiStore.getState().repoGenesisId !== null) {
        closeRepo()
        return
      }
      const active = useCards.getState().activeId
      if (active !== null) openRepo(active)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openRepo, closeRepo])
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1">
        <IdeasCanvas />
      </div>
      {repoGenesisId === null ? null : <RepoPanel genesisId={repoGenesisId} onClose={closeRepo} />}
    </div>
  )
}
