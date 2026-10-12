import { useQueryClient } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FolderFileView } from '@shared/ipc/folders'
import { call } from '../../lib/ipc'
import type { FolderNodeType } from '../buildGraph'
import { useSidePanel } from '../side/sidePanelStore'
import { seedOf } from './folderArt'
import { GlassFolder, type GlassFolderFile } from './GlassFolder'

/** Seconde ligne d'une feuille : extension et origine (« MD · par Claude »). */
function metaOf(file: FolderFileView): string {
  const dot = file.name.lastIndexOf('.')
  const extension = dot > 0 ? file.name.slice(dot + 1).toUpperCase() : file.kind === 'doc' ? 'DOC' : 'FICHIER'
  return file.document?.origin === 'claude' ? `${extension} · par Claude` : extension
}

/**
 * Dossier d'un nœud sur la carte (spec 028 US1) : un clic sur une feuille ouvre le fichier dans l'onglet du nœud du
 * panneau de droite (spec 027) ; ouvrir le dossier efface « nouveau ». Glissable par son verre (pas par une feuille).
 */
export function FolderNode({ data }: NodeProps<FolderNodeType>): React.JSX.Element {
  const client = useQueryClient()
  const openReader = useSidePanel((state) => state.openReader)
  const { badge, title, kindLabel, color, dimmed, side } = data

  const openFile = (index: number): void => {
    const file = badge.preview[index]
    if (file === undefined) return
    // Un document de l'app a son lecteur ; un fichier couvert par un élément, celui des fichiers d'élément.
    const reader =
      file.document !== undefined
        ? ({ source: 'document', path: file.document.id, tab: 'file', document: file.document } as const)
        : ({ source: 'element', path: file.path, tab: 'file', elementId: badge.neuronId } as const)
    if (badge.anchor.kind === 'workflow') {
      openReader(
        { nodeId: badge.anchor.key, genesisId: badge.anchor.genesisId, title, kindLabel, workflow: true },
        reader
      )
    } else {
      openReader({ nodeId: badge.anchor.id, neuronId: badge.neuronId, title, kindLabel }, reader)
    }
  }

  const opened = (open: boolean): void => {
    if (!open || !badge.unseen) return
    void call('folder:markSeen', { neuronId: badge.neuronId })
      .then(() => client.invalidateQueries({ queryKey: ['canvas'] }))
      .catch(() => undefined)
  }

  const files = badge.preview.map((file): GlassFolderFile => ({
    key: file.path,
    name: file.name,
    meta: metaOf(file),
    unseen: file.unseen
  }))
  return (
    <div className={dimmed ? 'opacity-40' : undefined}>
      <Handle
        type="target"
        position={side === 'left' ? Position.Right : Position.Top}
        isConnectable={false}
        className="neuron-handle"
      />
      <GlassFolder
        title={title}
        count={badge.count}
        files={files}
        color={color}
        seed={seedOf(badge.neuronId)}
        unseen={badge.unseen}
        onOpenFile={openFile}
        onOpenChange={opened}
      />
    </div>
  )
}
