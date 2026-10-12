import type { DocumentView } from '@shared/ipc/documents'
import type { DocumentRow } from '../../infrastructure/db/repositories/DocumentRepository'
import { fileLabel } from '../mcp/DocumentTools'

/** Vue IPC d'un document (spec 012) : sur la carte quand il est épinglé, dans le dossier de son nœud sinon. */
export function documentView(document: DocumentRow): DocumentView {
  return {
    id: document.id,
    neuronId: document.neuronId,
    genesisId: document.genesisId,
    title: document.title,
    fileLabel: fileLabel(document),
    width: document.width,
    height: document.height,
    origin: document.origin,
    offset: { x: document.offsetX, y: document.offsetY }
  }
}
