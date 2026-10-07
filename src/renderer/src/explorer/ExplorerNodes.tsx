import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { createContext, useContext, useState } from 'react'
import type { ExplorerNodeView } from '@shared/ipc/reprise'
import { CATEGORY_LABELS } from './labels'

/** Actions offertes aux nœuds de la carte (D16) : ouvrir un fichier dans le volet, zoomer dans un sous-dossier. */
export interface ExplorerNodeActions {
  readonly openFile: (path: string) => void
  readonly open: (key: string) => void
  /** Fichier ouvert dans le volet : mis en avant dans l'onglet « Fichiers » de son dossier. */
  readonly openPath: string | null
}

export const ExplorerNodeActionsContext = createContext<ExplorerNodeActions>({
  openFile: () => undefined,
  open: () => undefined,
  openPath: null
})

/** Données d'un nœud : un type recopié (React Flow exige un objet indexable, ce qu'une interface n'est pas). */
export type CodeNodeData = { readonly [K in keyof ExplorerNodeView]: ExplorerNodeView[K] } & {
  readonly selected: boolean
}
export type ModuleNodeType = Node<CodeNodeData, 'module'>
export type FolderNodeType = Node<CodeNodeData, 'folder'>

/** Taille fixe d'un nœud dossier : sa liste défile dedans (la mise en page du main en dépend, `FOLDER_ROW_HEIGHT`). */
export const FOLDER_NODE_SIZE = { width: 256, height: 248 } as const

function Handles(): React.JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className="neuron-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="neuron-handle" />
    </>
  )
}

/** Module (niveau 1, D16) : un nœud propre, plus marqué qu'un dossier ; double-clic ou zoom pour voir ses dossiers. */
export function ModuleNode({ data }: NodeProps<ModuleNodeType>): React.JSX.Element {
  const category = CATEGORY_LABELS[data.category]
  return (
    <div
      className={`w-60 rounded-2xl border-[3px] bg-surface-raised px-4 py-3 text-xs shadow-md ${category.tone} ${
        data.selected ? 'ring-2 ring-accent' : ''
      }`}
    >
      <Handles />
      <p className="text-[10px] uppercase tracking-wide text-content-muted">Module</p>
      <p className="flex items-center gap-1 text-sm font-semibold text-content">
        <span aria-hidden="true">▣</span>
        <span className="truncate" title={data.title}>
          {data.title}
        </span>
      </p>
      <p className="mt-1 flex justify-between gap-2">
        <span>
          <span aria-hidden="true">{category.icon}</span> {category.text}
        </span>
        <span className="text-content-muted">
          {data.folders.length} dossier{data.folders.length > 1 ? 's' : ''}
        </span>
      </p>
    </div>
  )
}

/**
 * Dossier (D16) : deux onglets dans le nœud, « Fichiers » (un clic ouvre le code dans le volet) et « Sous-dossiers »
 * (un clic zoome dedans). Les clics dans le nœud ne le sélectionnent pas et ne le déplacent pas.
 */
export function FolderNode({ data }: NodeProps<FolderNodeType>): React.JSX.Element {
  const actions = useContext(ExplorerNodeActionsContext)
  const category = CATEGORY_LABELS[data.category]
  const [tab, setTab] = useState<'files' | 'folders'>(
    data.files.length > 0 || data.folders.length === 0 ? 'files' : 'folders'
  )
  const stop = (event: React.MouseEvent): void => event.stopPropagation()
  return (
    <div
      style={FOLDER_NODE_SIZE}
      className={`flex flex-col overflow-hidden rounded-lg border-2 bg-surface text-xs shadow-sm ${category.tone} ${
        data.selected ? 'ring-2 ring-accent' : ''
      }`}
    >
      <Handles />
      <p className="flex items-center gap-1 px-3 pt-2 font-semibold text-content">
        <span aria-hidden="true">▤</span>
        <span className="truncate" title={data.title}>
          {data.title}
        </span>
      </p>
      <p className="px-3 text-content-muted">
        <span aria-hidden="true">{category.icon}</span> {category.text}
      </p>
      <div role="tablist" aria-label={`Contenu de ${data.title}`} className="nodrag mt-1 flex gap-1 px-2">
        {(['files', 'folders'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            disabled={value === 'folders' && data.folders.length === 0}
            onClick={(event) => {
              stop(event)
              setTab(value)
            }}
            className={`rounded px-2 py-0.5 disabled:opacity-40 ${
              tab === value ? 'bg-surface-raised font-semibold text-content' : 'text-content-muted'
            }`}
          >
            {value === 'files' ? `Fichiers (${data.files.length})` : `Sous-dossiers (${data.folders.length})`}
          </button>
        ))}
      </div>
      <ul className="nodrag nowheel mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-2 text-content">
        {tab === 'files'
          ? data.files.map((file) => (
              <li key={file.key}>
                <button
                  type="button"
                  onClick={(event) => {
                    stop(event)
                    actions.openFile(file.path)
                  }}
                  aria-current={actions.openPath === file.path ? 'true' : undefined}
                  className={`w-full truncate rounded px-1 py-0.5 text-left hover:bg-surface-raised ${
                    actions.openPath === file.path ? 'bg-accent/15 font-semibold' : ''
                  }`}
                  title={file.path}
                >
                  <span aria-hidden="true">{CATEGORY_LABELS[file.category].icon}</span> {file.title}
                </button>
              </li>
            ))
          : data.folders.map((folder) => (
              <li key={folder.key}>
                <button
                  type="button"
                  onClick={(event) => {
                    stop(event)
                    actions.open(folder.key)
                  }}
                  className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-surface-raised"
                >
                  <span aria-hidden="true">▤</span> {folder.title} <span aria-hidden="true">›</span>
                </button>
              </li>
            ))}
        {tab === 'files' && data.hiddenFiles > 0 ? (
          <li className="px-1 text-content-muted">+ {data.hiddenFiles} masqués (filtres)</li>
        ) : null}
      </ul>
    </div>
  )
}
