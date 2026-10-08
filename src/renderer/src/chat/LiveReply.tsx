import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { ChatMessageView } from '@shared/ipc/chat'
import { Markdown } from './Markdown'
import { ThinkingIndicator } from './ThinkingIndicator'

/** Condensation de l'orbe avant de s'ouvrir en réponse (« condense » du composant d'origine). */
const CONDENSE_MS = 300
/** Dépliement de la bulle : de la taille de l'orbe à celle de la réponse (courbe « card » du composant d'origine). */
const UNFOLD = { type: 'tween', duration: 0.5, ease: [0.65, 0, 0.2, 1] } as const

type Stage = 'thinking' | 'condense' | 'text'

/**
 * Bulle de la réponse en cours (référence 21st.dev « AI thinking orb ») : l'orbe réfléchit, puis, quand Claude
 * commence à écrire, se condense et s'ouvre en bulle de réponse ; le texte sort d'un léger flou et continue de
 * s'écrire au fil de l'eau. Animations réduites : simple fondu, sans condensation ni dépliement.
 */
export function LiveReply({
  messages,
  partial,
  orbLayoutId,
  arriving,
  reduced,
  waiting = false
}: {
  readonly messages: readonly ChatMessageView[]
  readonly partial: string
  readonly orbLayoutId: string
  readonly arriving: boolean
  readonly reduced: boolean
  /** La bille est encore dans la bande du bas : la place de l'orbe est réservée, vide, pour ne rien pousser ensuite. */
  readonly waiting?: boolean
}): React.JSX.Element {
  const [stage, setStage] = useState<Stage>(partial === '' ? 'thinking' : 'text')

  const hasText = partial !== ''
  useEffect(() => {
    if (!hasText) {
      // Nouveau temps de réflexion dans le même tour (après une action de Claude) : l'orbe revient.
      setStage('thinking')
      return undefined
    }
    // Seul le passage « pas de texte → texte » déclenche la condensation.
    setStage((current) => (current === 'thinking' ? (reduced ? 'text' : 'condense') : current))
    if (reduced) return undefined
    const timer = window.setTimeout(() => setStage('text'), CONDENSE_MS)
    return () => window.clearTimeout(timer)
  }, [hasText, reduced])

  return (
    <motion.div
      layout
      transition={UNFOLD}
      className="mt-4 max-w-[85%] self-start overflow-hidden rounded-2xl bg-surface-raised px-4 py-3 text-sm leading-relaxed"
    >
      {stage === 'thinking' ? (
        <ThinkingIndicator messages={messages} orbLayoutId={orbLayoutId} arriving={arriving} placeholder={waiting} />
      ) : stage === 'condense' ? (
        <div className="relative flex items-center gap-2">
          {/* Le texte est déjà là pour les lecteurs d'écran : l'animation ne le retarde que pour l'œil. */}
          <span className="sr-only">{partial}</span>
          <motion.span
            aria-hidden="true"
            className="chat-orb-ball block"
            style={{ width: 44, height: 44, borderRadius: 999 }}
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: [1, 1.08, 0.35], opacity: [1, 1, 0] }}
            transition={{ duration: CONDENSE_MS / 1000, times: [0, 0.35, 1], ease: 'easeInOut' }}
          />
          <motion.span
            aria-hidden="true"
            className="absolute left-0 top-0 block border-2 border-accent"
            style={{ width: 44, height: 44, borderRadius: 999 }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: CONDENSE_MS / 1000, ease: 'easeOut' }}
          />
        </div>
      ) : (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, filter: 'blur(4px)', y: 4 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Markdown text={partial} />
        </motion.div>
      )}
    </motion.div>
  )
}
