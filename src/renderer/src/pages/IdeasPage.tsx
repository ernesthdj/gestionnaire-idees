import { useUiStore } from '../app/uiStore'
import { Button } from '../components/atoms/Button'
import { IdeasCanvas } from '../canvas/IdeasCanvas'

/** Écran Idées : la carte, ou la plongée dans une idée (plongée livrée avec US3). */
export function IdeasPage(): React.JSX.Element {
  const diveRootId = useUiStore((state) => state.diveRootId)
  const closeDive = useUiStore((state) => state.closeDive)
  if (diveRootId === null) return <IdeasCanvas />
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <p className="max-w-md text-center text-sm text-content-muted">
        La plongée dans une idée (questions de l’IA, sous-neurones, jauge) arrive à la prochaine étape.
      </p>
      <Button onClick={closeDive}>Retour aux idées</Button>
    </div>
  )
}
