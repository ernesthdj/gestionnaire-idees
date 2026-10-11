import type { ReactNode } from 'react'
import { ChatPanel } from '../../chat/ChatPanel'
import { ElementFileReader } from '../../chat/ElementFiles'
import { FileViewer } from '../FileViewer'
import { DocumentReader } from '../nodes/DocumentNode'
import { WorkflowFileReader } from '../workflow/WorkflowCard'
import { useSidePanel, type ChatTab, type TabReader, type WorkflowChatTab } from './sidePanelStore'

/** En-tête d'un onglet de nœud (D4) : sa sorte, son titre, et la fermeture de l'onglet (le tour continue). */
export function TabHeader({ tab }: { readonly tab: ChatTab | WorkflowChatTab }): React.JSX.Element {
  const close = useSidePanel((state) => state.close)
  return (
    <div className="side-head">
      <div className="side-head-text">
        {tab.kindLabel === '' ? null : <p className="side-head-kind">{tab.kindLabel}</p>}
        <h2 className="side-head-title" title={tab.title}>
          {tab.title}
        </h2>
      </div>
      <button
        type="button"
        className="detail-card-close"
        aria-label={`Fermer l’onglet « ${tab.title} »`}
        onClick={() => close(tab.key)}
      >
        ✕
      </button>
    </div>
  )
}

/** Lecteur d'un fichier dans l'onglet de son nœud (D5) ; `onBack` revient à la conversation. */
export function TabReaderView({
  reader,
  onBack
}: {
  readonly reader: TabReader
  readonly onBack: () => void
}): React.JSX.Element | null {
  if (reader.source === 'workflow' && reader.genesisId !== undefined)
    return <WorkflowFileReader key={reader.path} genesisId={reader.genesisId} path={reader.path} onClose={onBack} />
  if (reader.source === 'deliverable' && reader.deliverableNeuronId !== undefined)
    return <FileViewer key={reader.path} neuronId={reader.deliverableNeuronId} path={reader.path} onClose={onBack} />
  if (reader.source === 'element' && reader.elementId !== undefined)
    return <ElementFileReader key={reader.path} elementId={reader.elementId} path={reader.path} onBack={onBack} />
  if (reader.source === 'document' && reader.document !== undefined)
    return (
      <>
        <div className="flex justify-end">
          <button type="button" className="detail-card-close" aria-label="Fermer le document" onClick={onBack}>
            ✕
          </button>
        </div>
        <DocumentReader document={reader.document} />
      </>
    )
  return null
}

/**
 * Corps d'un onglet : le lecteur s'il est ouvert, sinon la conversation (`chat`). La conversation porte déjà le titre et
 * la sorte du nœud dans son en-tête (et son × ferme l'onglet) ; l'en-tête de l'onglet ne s'affiche qu'avec un lecteur ou
 * tant que la conversation n'est pas là.
 */
export function TabBody({
  tab,
  chat,
  chatReady
}: {
  readonly tab: ChatTab | WorkflowChatTab
  readonly chat: ReactNode
  readonly chatReady: boolean
}): React.JSX.Element {
  const closeReader = useSidePanel((state) => state.closeReader)
  if (tab.reader === null && chatReady) return <div className="side-body">{chat}</div>
  return (
    <>
      <TabHeader tab={tab} />
      <div className="side-body side-body-padded">
        {tab.reader === null ? chat : <TabReaderView reader={tab.reader} onBack={() => closeReader(tab.key)} />}
      </div>
    </>
  )
}

/** Onglet d'un nœud de la carte (idée, étape, élément ; document ou livrable pour leur lecteur). */
export function ChatTabContent({ tab }: { readonly tab: ChatTab }): React.JSX.Element {
  const close = useSidePanel((state) => state.close)
  return (
    <TabBody
      tab={tab}
      chatReady={tab.neuronId !== null}
      chat={tab.neuronId === null ? null : <ChatPanel neuronId={tab.neuronId} onClose={() => close(tab.key)} />}
    />
  )
}
