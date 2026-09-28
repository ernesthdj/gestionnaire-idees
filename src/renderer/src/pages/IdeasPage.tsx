import { useUiStore } from '../app/uiStore'
import { IdeasCanvas } from '../canvas/IdeasCanvas'
import { DiveView } from '../dive/DiveView'

/** Écran Idées : la carte, ou la plongée dans une idée. */
export function IdeasPage(): React.JSX.Element {
  const diveRootId = useUiStore((state) => state.diveRootId)
  const closeDive = useUiStore((state) => state.closeDive)
  return diveRootId === null ? <IdeasCanvas /> : <DiveView key={diveRootId} rootId={diveRootId} onClose={closeDive} />
}
