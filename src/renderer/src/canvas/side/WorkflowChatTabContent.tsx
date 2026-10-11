import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ChatPanel } from '../../chat/ChatPanel'
import { call, IpcFailure } from '../../lib/ipc'
import { TabBody } from './ChatTabContent'
import { useSidePanel, type WorkflowChatTab } from './sidePanelStore'

/** Clé de la conversation propre à une tâche Workflow (spec 023 D6) : retrouvée ou créée à l'affichage de l'onglet. */
export const workflowChatKey = (key: string): readonly unknown[] => ['workflow-chat', key]

/**
 * Onglet d'une tâche Workflow (spec 027, spec 023 D6) : sa conversation propre, la consigne préparée dans le champ
 * (`draftKey` = la tâche) ; rien n'est envoyé sans geste de mentalyas.
 */
export function WorkflowChatTabContent({ tab }: { readonly tab: WorkflowChatTab }): React.JSX.Element {
  const close = useSidePanel((state) => state.close)
  const bindNeuron = useSidePanel((state) => state.bindNeuron)
  const chat = useQuery({
    queryKey: workflowChatKey(tab.nodeId),
    queryFn: () =>
      call<{ readonly neuronId: string }>('workflow:chat', {
        genesisId: tab.genesisId,
        key: tab.nodeId,
        title: `${tab.kindLabel} · ${tab.title}`.slice(0, 200)
      }),
    enabled: tab.reader === null,
    staleTime: Infinity
  })
  const neuronId = chat.data?.neuronId
  useEffect(() => {
    if (neuronId !== undefined) bindNeuron(tab.key, neuronId)
  }, [bindNeuron, tab.key, neuronId])
  return (
    <TabBody
      tab={tab}
      chatReady={chat.data !== undefined}
      chat={
        chat.data === undefined ? (
          <p
            className={chat.error === null ? 'text-content-muted' : 'text-con'}
            role={chat.error === null ? undefined : 'alert'}
          >
            {chat.error === null
              ? 'Ouverture de la conversation…'
              : chat.error instanceof IpcFailure
                ? chat.error.message
                : 'La conversation n’a pas pu être ouverte.'}
          </p>
        ) : (
          <ChatPanel neuronId={chat.data.neuronId} draftKey={tab.nodeId} onClose={() => close(tab.key)} />
        )
      }
    />
  )
}
