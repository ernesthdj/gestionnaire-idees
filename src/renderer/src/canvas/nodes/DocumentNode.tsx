import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { DOCUMENT_SIZE_LIMITS, type DocumentContentView } from '@shared/ipc/documents'
import { useUiStore } from '../../app/uiStore'
import { Markdown } from '../../chat/Markdown'
import { call, IpcFailure } from '../../lib/ipc'
import type { DocumentNodeType } from '../buildGraph'
import { ClaudeBadge } from './ClaudeBadge'

export const documentKey = (id: string): readonly string[] => ['document', id]

/** Icône fichier de l'en-tête (comme un fichier d'un .canvas Obsidian). */
function FileIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" className="shrink-0">
      <path d="M4 1.5h5l3 3v10H4z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9 1.5v3h3M6 8h4M6 10.5h4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

/**
 * Document Markdown d'un neurone (spec 012) : le fichier est lu par le main (source de vérité) et rendu ici, sans
 * HTML brut ; le contenu défile dans le nœud (`nowheel`) sans zoomer la carte.
 */
export function DocumentNode({ data, selected }: NodeProps<DocumentNodeType>): React.JSX.Element {
  const { document, dimmed } = data
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const content = useQuery({
    queryKey: documentKey(document.id),
    queryFn: () => call<DocumentContentView>('document:get', { id: document.id })
  })

  // Nouvelle taille gardée ; la carte se redispose (les annexes suivantes et les nœuds dessous se décalent).
  const resize = async (width: number, height: number): Promise<void> => {
    try {
      await call('document:resize', { id: document.id, width: Math.round(width), height: Math.round(height) })
      await client.invalidateQueries({ queryKey: ['canvas'] })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : 'La taille n’a pas pu être enregistrée.')
    }
  }

  const act = async (channel: 'document:reveal' | 'document:recreate', failure: string): Promise<void> => {
    try {
      await call(channel, { id: document.id })
      if (channel === 'document:recreate') await client.invalidateQueries({ queryKey: documentKey(document.id) })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : failure)
    }
  }

  return (
    <section
      aria-label={`Document : ${document.title}`}
      className={`document-node flex h-full w-full flex-col overflow-hidden rounded-xl border border-content-muted/40 bg-surface text-content shadow-lg${dimmed ? ' plan-dimmed' : ''}`}
    >
      <NodeResizer
        isVisible={selected === true}
        minWidth={DOCUMENT_SIZE_LIMITS.minWidth}
        minHeight={DOCUMENT_SIZE_LIMITS.minHeight}
        maxWidth={DOCUMENT_SIZE_LIMITS.maxWidth}
        maxHeight={DOCUMENT_SIZE_LIMITS.maxHeight}
        onResizeEnd={(_event, box) => void resize(box.width, box.height)}
      />
      <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="neuron-handle" />
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-content-muted/20 bg-surface-raised px-3 text-xs">
        <FileIcon />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">{document.title}</span>
          <span className="ml-2 text-content-muted">{document.fileLabel}</span>
        </span>
        {document.origin === 'claude' ? <ClaudeBadge /> : null}
        <button
          type="button"
          className="nodrag rounded px-1.5 py-0.5 hover:bg-surface"
          title="Montrer le fichier dans l’Explorateur"
          onClick={() => void act('document:reveal', 'Le fichier n’a pas pu être montré.')}
        >
          Ouvrir le dossier
        </button>
      </header>
      <div className="nodrag nowheel min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed" tabIndex={0}>
        {content.isError ? (
          <p role="alert">Le document n’a pas pu être lu.</p>
        ) : content.data === undefined ? (
          <p className="text-content-muted">Lecture…</p>
        ) : (
          <>
            {content.data.missing ? (
              <p role="alert" className="mb-2 rounded-md bg-surface-raised p-2 text-xs">
                Fichier introuvable sur le disque : voici sa dernière version connue.{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void act('document:recreate', 'Le fichier n’a pas pu être recréé.')}
                >
                  Recréer le fichier
                </button>
              </p>
            ) : null}
            <Markdown text={content.data.content} />
          </>
        )}
      </div>
    </section>
  )
}
