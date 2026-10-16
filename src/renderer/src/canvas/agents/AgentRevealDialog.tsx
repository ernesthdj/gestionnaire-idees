import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AGENT_ROLE_LABELS, type AgentProfileView } from '@shared/agents/profile'
import { ChatPanel } from '../../chat/ChatPanel'
import { call, IpcFailure } from '../../lib/ipc'
import { DraftPanel } from '../../skills/DraftPanel'
import { mintCharacter, mintRoom } from './character/mint'
import { rarer } from './character/random'
import { MintCard } from './character/MintCard'
import { SkillsCards, useSkillsOfVisio } from './VisioSkills'

/** Confettis de la naissance : assez pour la fête, peu pour rester léger. */
const CONFETTI = 28

/** Le chat suit la fenêtre comme en visio : son en-tête (nom, rôle) est déjà celui de la fenêtre. */
const quiet = (): void => undefined

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
  const chat = useQuery({
    queryKey: ['agents', 'chat', profile.id],
    queryFn: () => call<{ neuronId: string }>('agents:chat', { profileId: profile.id }),
    enabled: chatting,
    retry: false
  })
  const chatId = chat.data?.neuronId ?? null
  const skills = useSkillsOfVisio(chatId, profile, since)
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
        className={`agent-reveal relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-surface text-sm text-content shadow-xl ${chatting ? 'max-w-6xl' : 'max-w-2xl'}`}
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
        <div className={chatting ? 'grid min-h-0 flex-1 grid-cols-2' : 'contents'}>
          <div className="min-h-0 overflow-auto p-4">
            <MintCard
              profileId={profile.id}
              role={profile.role}
              name={profile.name}
              delivered={profile.delivered}
              key={chatting ? 'discussion' : 'carte'}
              reveal={celebrate && !chatting}
              size="large"
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {chatting ? null : (
                <button
                  ref={primary}
                  type="button"
                  className="card-button card-button-primary"
                  onClick={() => setChatting(true)}
                >
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
            <div className="flex min-h-[60vh] min-w-0 flex-col border-l border-content-muted/20">
              <SkillsCards skills={skills} onOpenDraft={setDraftOpen} />
              <div className="min-h-0 flex-1">
                {draftOpen !== null ? (
                  <DraftPanel draftId={draftOpen} onDone={() => setDraftOpen(null)} />
                ) : chat.data !== undefined ? (
                  <ChatPanel neuronId={chat.data.neuronId} onClose={() => setChatting(false)} onActivity={quiet} />
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
