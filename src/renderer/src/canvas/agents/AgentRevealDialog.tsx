import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AGENT_ROLE_LABELS, type AgentProfileView } from '@shared/agents/profile'
import { ChatPanel } from '../../chat/ChatPanel'
import { call, IpcFailure } from '../../lib/ipc'
import { DraftPanel } from '../../skills/DraftPanel'
import { VisioClock } from './AgentNode'
import { mintCharacter, mintRoom } from './character/mint'
import { rarer } from './character/random'
import { MintCard } from './character/MintCard'
import { RestartChat } from './RestartChat'
import { SkillsCards, useSkillsOfVisio } from './VisioSkills'
import { subtitleOf } from './visioStore'

/** Confettis de la naissance : assez pour la fête, peu pour rester léger. */
const CONFETTI = 28

/** Après sa réponse, le dernier sous-titre reste un instant à l'écran (comme la visio de la carte). */
const SUBTITLE_HOLD_MS = 4000

/** Place et départ d’un confetti, dispersés sans hasard (même pluie à chaque naissance). */
const confetto = (index: number): React.CSSProperties =>
  ({ '--x': `${(index * 37) % 100}%`, '--d': `${(index * 53) % 640}ms` }) as React.CSSProperties

/**
 * Fenêtre de l'agent (L1o D22) : son personnage en grand dans sa chambre, ses calques et son rang. À sa création, elle
 * le révèle (« Félicitations ! », confettis de la couleur de son rang) ; depuis la gestion des agents, elle le montre.
 * « Discuter avec lui » ouvre un tête-à-tête hors de toute tâche (persona de son profil) où il peut proposer des skills.
 */
export function AgentRevealDialog({
  profile,
  celebrate,
  onEdit,
  onClose
}: {
  readonly profile: AgentProfileView
  /** Vrai juste après « Créer l'agent ». */
  readonly celebrate: boolean
  readonly onEdit: () => void
  readonly onClose: () => void
}): React.JSX.Element {
  const titleId = useId()
  const primary = useRef<HTMLButtonElement>(null)
  const [chatting, setChatting] = useState(false)
  const [since] = useState(() => Date.now())
  const [draftOpen, setDraftOpen] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const chat = useQuery({
    queryKey: ['agents', 'chat', profile.id],
    queryFn: () => call<{ neuronId: string }>('agents:chat', { profileId: profile.id }),
    enabled: chatting,
    retry: false
  })
  const chatId = chat.data?.neuronId ?? null
  const skills = useSkillsOfVisio(chatId, profile, since)
  // La discussion est une visio (L1o D22) : sa tête bouge pendant qu'il répond, sa réponse passe en sous-titres.
  const [callSince, setCallSince] = useState(0)
  const [voice, setVoice] = useState({ talking: false, subtitle: '' })
  const hold = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(hold.current), [])
  const onActivity = useCallback((busy: boolean, partial: string) => {
    window.clearTimeout(hold.current)
    if (busy) {
      setVoice({ talking: true, subtitle: subtitleOf(partial) })
      return
    }
    setVoice((current) => ({ talking: false, subtitle: current.subtitle }))
    hold.current = window.setTimeout(() => setVoice({ talking: false, subtitle: '' }), SUBTITLE_HOLD_MS)
  }, [])
  const startCall = (): void => {
    setCallSince(Date.now())
    setChatting(true)
  }
  const character = mintCharacter(profile.id, profile.role)
  const rank = rarer(character.rank, mintRoom(character.seed, profile.delivered).rank)

  useEffect(() => primary.current?.focus(), [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation()
          onClose()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // En discussion, une taille fixée d'avance : la conversation défile à l'intérieur, la fenêtre ne grandit pas.
        className={`agent-reveal relative flex flex-col overflow-hidden rounded-xl bg-surface text-sm text-content shadow-xl ${chatting ? 'h-[min(88vh,760px)] w-[min(1120px,100%)]' : 'max-h-[90vh] w-full max-w-2xl'}`}
      >
        {celebrate && !chatting ? (
          <div className="mint-confetti" data-tier={rank} aria-hidden="true">
            {Array.from({ length: CONFETTI }, (_, index) => (
              <span key={index} style={confetto(index)} />
            ))}
          </div>
        ) : null}
        <div className="flex items-start gap-2 p-4 pb-0">
          <div className="min-w-0 flex-1 text-center">
            {celebrate ? (
              <p className="text-xs font-semibold tracking-wide text-accent uppercase">Félicitations !</p>
            ) : null}
            <h2 id={titleId} className="truncate text-lg font-semibold">
              {celebrate ? `« ${profile.name} » rejoint l’équipe` : profile.name}
            </h2>
            <p className="text-content-muted">
              {AGENT_ROLE_LABELS[profile.role]} · {character.base.name} de l’univers {character.universe.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Fermer la fenêtre de ${profile.name}`}
            className="h-8 w-8 shrink-0 rounded-md hover:bg-surface-raised"
          >
            ×
          </button>
        </div>
        <div className={chatting ? 'grid min-h-0 flex-1 grid-cols-2 overflow-hidden' : 'contents'}>
          <div className="min-h-0 overflow-auto p-4">
            <MintCard
              profileId={profile.id}
              role={profile.role}
              name={profile.name}
              delivered={profile.delivered}
              key={chatting ? 'discussion' : 'carte'}
              reveal={celebrate && !chatting}
              size="large"
              visio={chatting ? { talking: voice.talking } : null}
              overlay={
                chatting ? (
                  <>
                    <span className="agent-visio-bar" aria-hidden="true">
                      <span className="agent-visio-dot" />
                      En visio avec {profile.name}
                      <VisioClock since={callSince} />
                    </span>
                    {voice.subtitle === '' ? null : (
                      <span className="agent-visio-subs mint-visio-subs" aria-hidden="true">
                        {voice.subtitle}
                      </span>
                    )}
                  </>
                ) : null
              }
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {chatting ? null : (
                <button ref={primary} type="button" className="card-button card-button-primary" onClick={startCall}>
                  Discuter avec lui
                </button>
              )}
              <button type="button" className="card-button card-button-ghost" onClick={onEdit}>
                Modifier le profil
              </button>
              <button type="button" className="card-button card-button-ghost" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
          {chatting ? (
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-content-muted/20">
              {chat.data === undefined ? null : (
                <div className="border-b border-content-muted/20 px-4 py-2">
                  <RestartChat
                    neuronId={chat.data.neuronId}
                    disabled={voice.talking}
                    onDone={() => {
                      setDraftOpen(null)
                      setRound((value) => value + 1)
                    }}
                  />
                </div>
              )}
              <SkillsCards skills={skills} onOpenDraft={setDraftOpen} />
              {/* Un seul défilement : celui des messages (la conversation tient la hauteur, le champ reste en bas). */}
              <div
                className={`flex min-h-0 flex-1 flex-col ${draftOpen === null ? 'overflow-hidden' : 'overflow-y-auto'}`}
              >
                {draftOpen !== null ? (
                  <DraftPanel draftId={draftOpen} onDone={() => setDraftOpen(null)} />
                ) : chat.data !== undefined ? (
                  <ChatPanel
                    key={`${chat.data.neuronId}-${round}`}
                    neuronId={chat.data.neuronId}
                    onClose={() => setChatting(false)}
                    onActivity={onActivity}
                    compact
                  />
                ) : chat.error !== null ? (
                  <p role="alert" className="p-4 text-con">
                    {chat.error instanceof IpcFailure ? chat.error.message : 'La conversation n’a pas pu s’ouvrir.'}
                  </p>
                ) : (
                  <p className="p-4 text-content-muted">Ouverture…</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body
  )
}
