import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PASS_NATURE_LABELS } from '@shared/agents/pipeline'
import { AGENT_ROLE_LABELS } from '@shared/agents/profile'
import { ChatPanel } from '../../chat/ChatPanel'
import { Markdown } from '../../chat/Markdown'
import { call, IpcFailure } from '../../lib/ipc'
import { agentsTitle, useSidePanel } from '../side/sidePanelStore'
import { AGENT_VISUAL_LABELS, runOf, visualOf } from './agentGraph'
import { missionOf } from './AgentsTabContent'
import type { AgentNodeData } from './agentTypes'
import { useAssemblyActions, useAssemblyData } from './useAssemblies'
import { DraftPanel } from '../../skills/DraftPanel'
import { SkillsCards, useSkillsOfVisio } from './VisioSkills'
import { subtitleOf, useVisio } from './visioStore'

/** Après sa réponse, le dernier sous-titre reste un instant à l'écran. */
const SUBTITLE_HOLD_MS = 4000

/**
 * Volet flottant à côté d'un agent en visio (L1o D13) : qui il est et où il en est, sa mission et son dernier rapport
 * (repliés), puis la conversation avec lui (`claude -p` avec la persona de son profil, reprise d'un appel à l'autre).
 * Ce qu'il répond passe en sous-titres sur la visio. L'assemblage (sa part, les liens, le lancement) se gère dans le
 * panneau de droite.
 */
export function AgentVisioPanel({ data }: { readonly data: AgentNodeData }): React.JSX.Element {
  const { sketches, runs, profiles } = useAssemblyData()
  const close = useVisio((state) => state.close)
  const speak = useVisio((state) => state.speak)
  const openAgents = useSidePanel((state) => state.openAgents)
  const sketch = sketches.find((entry) => entry.nodeId === data.hostId)
  const agent = sketch?.agents.find((entry) => entry.id === data.agentId)
  const profile = profiles.find((entry) => entry.id === data.profileId)
  const run = sketch === undefined ? undefined : runOf(sketch, runs)
  const live = run?.agents.find((entry) => entry.agentId === data.agentId)
  const visual = visualOf(run, live)
  const chat = useQuery({
    queryKey: ['assembly', 'chat', data.hostId, data.agentId],
    queryFn: () => call<{ neuronId: string }>('assembly:chat', { nodeId: data.hostId, agentId: data.agentId }),
    retry: false
  })
  const chatId = chat.data?.neuronId ?? null
  const since = useVisio((state) => state.since)
  const [draftOpen, setDraftOpen] = useState<string | null>(null)
  const skills = useSkillsOfVisio(chatId, profile, since)
  const running = run?.state === 'running'
  const actions = useAssemblyActions()
  const dismiss = async (): Promise<void> => {
    if (sketch === undefined || running) return
    if (await actions.dismiss(sketch, data.agentId)) close()
  }

  // Échap raccroche, où que soit le focus (sauf pendant que Claude répond : Échap l'interrompt d'abord).
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented && !useVisio.getState().talking) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const hold = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(hold.current), [])
  const onActivity = useCallback(
    (busy: boolean, partial: string) => {
      window.clearTimeout(hold.current)
      if (busy) {
        speak(true, subtitleOf(partial))
        return
      }
      speak(false, useVisio.getState().subtitle)
      hold.current = window.setTimeout(() => speak(false, ''), SUBTITLE_HOLD_MS)
    },
    [speak]
  )

  return (
    <section className="agent-visio-panel nodrag nowheel" aria-label={`Visio avec ${data.name}`}>
      <header className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{data.name}</h3>
          <p className="text-xs text-content-muted">
            {profile === undefined ? 'Profil supprimé' : `${AGENT_ROLE_LABELS[profile.role]} · ${profile.model}`}
            {' · '}
            <span className="font-medium text-content">{AGENT_VISUAL_LABELS[visual]}</span>
            {live?.pass === undefined
              ? null
              : ` — passe ${live.pass}${live.nature === undefined ? '' : ` (${PASS_NATURE_LABELS[live.nature]})`}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className="card-button card-button-ghost" onClick={close}>
            Raccrocher
          </button>
          <button
            type="button"
            aria-label="Raccrocher et fermer le volet"
            title="Fermer (Échap)"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-surface-raised"
          >
            ×
          </button>
        </div>
      </header>
      {live?.message === undefined ? null : (
        <p role="alert" className="px-4 text-sm text-con">
          {live.message}
        </p>
      )}
      <details className="px-4 text-sm">
        <summary className="cursor-pointer font-medium">Mission et rapport</summary>
        {agent === undefined || sketch === undefined ? null : (
          <p className="mt-2 rounded-md bg-surface-raised p-2">{missionOf(agent, sketch.agents.length === 1)}</p>
        )}
        {live?.report === undefined ? (
          <p className="mt-2 text-content-muted">Pas encore de rapport : il arrive quand l’agent a fini sa passe.</p>
        ) : (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-content-muted/20 p-2">
            <Markdown text={live.report} />
          </div>
        )}
        <button
          type="button"
          className="card-button card-button-ghost mt-2"
          onClick={() =>
            openAgents({
              nodeId: data.hostId,
              genesisId: data.genesisId,
              title: agentsTitle(data.hostTitle),
              kindLabel: 'Agents',
              agentId: data.agentId
            })
          }
        >
          Gérer l’assemblage
        </button>
        <button
          type="button"
          className="card-button card-button-ghost mt-2 ml-2"
          disabled={running || sketch === undefined}
          title={running ? 'L’assemblage travaille : arrête-le d’abord.' : undefined}
          onClick={() => void dismiss()}
        >
          Renvoyer l’agent
        </button>
      </details>
      <SkillsCards skills={skills} onOpenDraft={setDraftOpen} />
      <div className="agent-visio-chat">
        {draftOpen !== null ? (
          <DraftPanel draftId={draftOpen} onDone={() => setDraftOpen(null)} />
        ) : chat.data !== undefined ? (
          <ChatPanel neuronId={chat.data.neuronId} onClose={close} onActivity={onActivity} />
        ) : chat.error !== null ? (
          <p role="alert" className="p-4 text-sm text-con">
            {chat.error instanceof IpcFailure ? chat.error.message : 'La visio n’a pas pu commencer.'}
          </p>
        ) : (
          <p className="p-4 text-sm text-content-muted">Appel en cours…</p>
        )}
      </div>
    </section>
  )
}
