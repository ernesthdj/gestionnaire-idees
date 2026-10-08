import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DocumentContentView, DocumentView } from '@shared/ipc/documents'
import { useUiStore } from '../../app/uiStore'
import { Markdown } from '../../chat/Markdown'
import { call, IpcFailure } from '../../lib/ipc'
import type { DocumentNodeType } from '../buildGraph'
import { LivingNode } from '../living/LivingNode'
import { ClaudeBadge } from './ClaudeBadge'

export const documentKey = (id: string): readonly string[] => ['document', id]

/**
 * Lecture d'un document Markdown (spec 012) : le fichier est lu par le main (source de vérité) et rendu sans HTML
 * brut ; « Ouvrir le dossier » le montre dans l'Explorateur ; un fichier disparu peut être recréé depuis sa dernière
 * version. Affichée dans le lecteur de la carte de détails (spec 022 D13, D18).
 */
export function DocumentReader({ document }: { readonly document: DocumentView }): React.JSX.Element {
  const client = useQueryClient()
  const showToast = useUiStore((state) => state.showToast)
  const content = useQuery({
    queryKey: documentKey(document.id),
    queryFn: () => call<DocumentContentView>('document:get', { id: document.id })
  })

  const act = async (channel: 'document:reveal' | 'document:recreate', failure: string): Promise<void> => {
    try {
      await call(channel, { id: document.id })
      if (channel === 'document:recreate') await client.invalidateQueries({ queryKey: documentKey(document.id) })
    } catch (error) {
      showToast(error instanceof IpcFailure ? error.message : failure)
    }
  }

  return (
    <section aria-label={`Document : ${document.title}`} className="flex h-full min-h-0 flex-col text-content">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-content-muted/20 px-1 text-xs">
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">{document.title}</span>
          <span className="ml-2 text-content-muted">{document.fileLabel}</span>
        </span>
        {document.origin === 'claude' ? <ClaudeBadge /> : null}
        <button
          type="button"
          className="nodrag rounded px-1.5 py-0.5 hover:bg-surface-raised"
          title="Montrer le fichier dans l’Explorateur"
          onClick={() => void act('document:reveal', 'Le fichier n’a pas pu être montré.')}
        >
          Ouvrir le dossier
        </button>
      </header>
      <div className="nodrag nowheel min-h-0 flex-1 overflow-y-auto px-1 py-3 text-sm leading-relaxed" tabIndex={0}>
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

/**
 * Document d'un neurone (spec 012) en petit cercle vivant (spec 022 D11) : pictogramme document, couleur de sa branche,
 * trombone (son texte se lit dans la carte), badge « par Claude ». Il se glisse comme avant (décalage mémorisé).
 */
export function DocumentNode({ data }: NodeProps<DocumentNodeType>): React.JSX.Element {
  const { document, dimmed, visual, open } = data
  return (
    <div className={`nopan living-document${dimmed ? ' plan-dimmed' : ''}`}>
      <LivingNode id={document.id} title={document.title} visual={visual} hasFiles open={open}>
        <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="neuron-handle" />
        <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="neuron-handle" />
        {document.origin === 'claude' ? (
          <span className="living-badge-claude" aria-hidden="true">
            <ClaudeBadge />
          </span>
        ) : null}
      </LivingNode>
    </div>
  )
}
