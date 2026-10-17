import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PASS_NATURE_LABELS } from '@shared/agents/pipeline'
import { AGENT_ROLE_LABELS } from '@shared/agents/profile'
import { ChatPanel } from '../../chat/ChatPanel'
import { Button } from '../../components/atoms/Button'
import { Markdown } from '../../chat/Markdown'
import { call, IpcFailure } from '../../lib/ipc'
import { agentsTitle, useSidePanel } from '../side/sidePanelStore'
import { AGENT_VISUAL_LABELS, runOf, visualOf } from './agentGraph'
import { missionOf } from './AgentsTabContent'
import type { AgentNodeData } from './agentTypes'
import { useAssemblyActions, useAssemblyData } from './useAssemblies'
import { DraftPanel } from '../../skills/DraftPanel'
import { RestartChat } from './RestartChat'
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
  // Agrandir le volet (demande de mentalyas, 2026-10-17) : un brouillon ou une longue réponse s'y lit en entier.
  const [wide, setWide] = useState(false)
  // Mission et rapport : repliés, la conversation garde la place.
  const [missionOpen, setMissionOpen] = useState(false)
  const missionId = useId()
  // Nouvelle conversation : le chat repart d'une vue neuve (sa clé change).
  const [round, setRound] = useState(0)
  const talking = useVisio((state) => state.talking)
  const skills = useSkillsOfVisio(chatId, profile, since)
  const running = run?.state === 'running'
  const actions = useAssemblyActions()
  const dismiss = async (): Promise<void> => {
    if (sketch === undefined || running) return
    if (await actions.dismiss(sketch, data.agentId)) close()
  }

  // Échap raccroche, où que soit le focus (sauf pendant que Claude répond : Échap l'interrompt d'abord) ; agrandi, il
  // remet d'abord le volet à côté de l'agent.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || useVisio.getState().talking) return
      if (wide) setWide(false)
      else close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, wide])

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

  const panel = (
    <section
      className={`agent-visio-panel nodrag nowheel${wide ? ' agent-visio-panel-wide' : ''}`}
      aria-label={`Visio avec ${data.name}`}
    >
      {/* En-tête : qui, où il en est, et les gestes sur l'appel ; une ligne d'outils en dessous. */}
      <header className="border-b border-content-muted/20 px-4 pt-4 pb-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">{data.name}</h3>
            <p className="mt-1 text-xs text-content-muted">
              {profile === undefined ? 'Profil supprimé' : `${AGENT_ROLE_LABELS[profile.role]} · ${profile.model}`}
              {' · '}
              <span className="font-medium text-content">{AGENT_VISUAL_LABELS[visual]}</span>
              {live?.pass === undefined
                ? null
                : ` — passe ${live.pass}${live.nature === undefined ? '' : ` (${PASS_NATURE_LABELS[live.nature]})`}`}
            </p>
          </div>
          <button
            type="button"
            aria-pressed={wide}
            title={wide ? 'Revenir à la taille normale' : 'Agrandir le volet'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-surface-raised"
            onClick={() => setWide((value) => !value)}
          >
            <span aria-hidden="true">{wide ? '⤡' : '⤢'}</span>
            <span className="sr-only">Agrandir le volet</span>
          </button>
          <Button className="shrink-0 px-3" title="Échap" onClick={close}>
            Raccrocher
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            aria-expanded={missionOpen}
            aria-controls={missionId}
            className="px-3 whitespace-nowrap"
            onClick={() => setMissionOpen((value) => !value)}
          >
            Mission et rapport <span aria-hidden="true">{missionOpen ? '▴' : '▾'}</span>
          </Button>
          <span className="flex-1" />
          {chat.data === undefined ? null : (
            <RestartChat
              neuronId={chat.data.neuronId}
              disabled={talking}
              onDone={() => {
                setDraftOpen(null)
                setRound((value) => value + 1)
              }}
            />
          )}
        </div>
      </header>
      {live?.message === undefined ? null : (
        <p role="alert" className="border-b border-content-muted/20 px-4 py-2 text-sm text-con">
          {live.message}
        </p>
      )}
      {!missionOpen ? null : (
        <div
          id={missionId}
          className="max-h-[45%] shrink-0 space-y-3 overflow-y-auto border-b border-content-muted/20 bg-surface-raised/40 px-4 py-3 text-sm"
        >
          {agent === undefined || sketch === undefined ? null : (
            <section aria-label="Mission">
              <h4 className="mb-1 text-xs font-semibold text-content-muted uppercase">Mission</h4>
              <p>{missionOf(agent, sketch.agents.length === 1)}</p>
            </section>
          )}
          <section aria-label="Dernier rapport">
            <h4 className="mb-1 text-xs font-semibold text-content-muted uppercase">Dernier rapport</h4>
            {live?.report === undefined ? (
              <p className="text-content-muted">Pas encore de rapport : il arrive quand l’agent a fini sa passe.</p>
            ) : (
              <Markdown text={live.report} />
            )}
          </section>
          <div className="flex flex-wrap gap-2">
            <Button
              className="px-3"
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
            </Button>
            <Button
              className="px-3"
              disabled={running || sketch === undefined}
              title={running ? 'L’assemblage travaille : arrête-le d’abord.' : undefined}
              onClick={() => void dismiss()}
            >
              Renvoyer l’agent
            </Button>
          </div>
        </div>
      )}
      <SkillsCards skills={skills} onOpenDraft={setDraftOpen} />
      <div className="agent-visio-chat">
        {draftOpen !== null ? (
          <DraftPanel draftId={draftOpen} onDone={() => setDraftOpen(null)} />
        ) : chat.data !== undefined ? (
          <ChatPanel
            key={`${chat.data.neuronId}-${round}`}
            neuronId={chat.data.neuronId}
            onClose={close}
            onActivity={onActivity}
            compact
          />
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
  // Agrandi : en fenêtre au-dessus de la carte et du panneau de droite (à côté de l'agent, il passerait dessous).
  return wide
    ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setWide(false)
          }}
        >
          {panel}
        </div>,
        document.body
      )
    : panel
}
