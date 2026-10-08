import { motion } from 'motion/react'
import type { ChatMessageView } from '@shared/ipc/chat'
import { useEffectiveSettings } from '../app/useAppSettings'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { ThinkingOrb } from './ThinkingOrb'
import { PHASE_LABELS, PHASE_PROGRAMS, thinkingPhase } from './thinkingPhase'
import './thinking.css'

/** Vol de la bille vers la bulle : départ lent, arrivée douce (courbe « fly » du composant d'origine). */
const FLY = { type: 'tween', duration: 0.7, ease: [0.5, 0, 0.1, 1] } as const

/**
 * « Claude réfléchit » (référence visuelle : « AI thinking orb » de 21st.dev) : orbe de points qui s'illumine et
 * libellé de l'activité réelle de Claude (réflexion, lecture, recherche, commande, écriture), tirée de ses dernières
 * actions. Pour les lecteurs d'écran : un seul texte stable, « Claude réfléchit », sans annonce à chaque changement.
 */

export function ThinkingIndicator({
  messages,
  orbLayoutId,
  arriving = false,
  placeholder = false
}: {
  readonly messages: readonly ChatMessageView[]
  /** Identité d'animation partagée avec la bille de la zone de saisie (morphing « le chat devient l'orbe »). */
  readonly orbLayoutId?: string
  /** La bille arrive de la zone de saisie : elle se fond dans l'orbe. */
  readonly arriving?: boolean
  /** Place réservée (la bille n'est pas encore partie) : même taille, rien de visible. */
  readonly placeholder?: boolean
}): React.JSX.Element {
  const settings = useEffectiveSettings()
  const reduced = useReducedMotionPreference(settings.motion)
  const phase = thinkingPhase(messages)
  if (placeholder) {
    return (
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="block shrink-0" style={{ width: 44, height: 44 }} />
        <span className="invisible text-sm font-medium">{PHASE_LABELS[phase]}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2" data-reduced={reduced ? 'true' : 'false'}>
      <motion.div
        {...(orbLayoutId === undefined ? {} : { layoutId: orbLayoutId })}
        transition={FLY}
        className="relative shrink-0"
        style={{ width: 44, height: 44, borderRadius: 999 }}
      >
        {arriving && !reduced ? (
          <motion.div
            aria-hidden="true"
            className="chat-orb-ball absolute inset-0"
            style={{ borderRadius: 999 }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.45, delay: 0.45 }}
          />
        ) : null}
        <motion.div
          initial={{ opacity: arriving && !reduced ? 0 : 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: arriving && !reduced ? 0.4 : 0 }}
        >
          <ThinkingOrb program={PHASE_PROGRAMS[phase]} reduced={reduced} />
        </motion.div>
      </motion.div>
      <span className="sr-only">Claude réfléchit…</span>
      <span key={phase} className="thinking-label text-sm font-medium" aria-hidden="true">
        <span className="thinking-label-text">{PHASE_LABELS[phase]}</span>
        <span className="thinking-dots">
          <i />
          <i />
          <i />
        </span>
      </span>
    </div>
  )
}
