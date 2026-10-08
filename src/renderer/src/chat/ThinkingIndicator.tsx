import type { ChatMessageView } from '@shared/ipc/chat'
import { useEffectiveSettings } from '../app/useAppSettings'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference'
import { ThinkingOrb } from './ThinkingOrb'
import { PHASE_LABELS, PHASE_PROGRAMS, thinkingPhase } from './thinkingPhase'
import './thinking.css'

/**
 * « Claude réfléchit » (référence visuelle : « AI thinking orb » de 21st.dev) : orbe de points qui s'illumine et
 * libellé de l'activité réelle de Claude (réflexion, lecture, recherche, commande, écriture), tirée de ses dernières
 * actions. Pour les lecteurs d'écran : un seul texte stable, « Claude réfléchit », sans annonce à chaque changement.
 */
export function ThinkingIndicator({ messages }: { readonly messages: readonly ChatMessageView[] }): React.JSX.Element {
  const settings = useEffectiveSettings()
  const reduced = useReducedMotionPreference(settings.motion)
  const phase = thinkingPhase(messages)
  return (
    <div className="flex items-center gap-2" data-reduced={reduced ? 'true' : 'false'}>
      <ThinkingOrb program={PHASE_PROGRAMS[phase]} reduced={reduced} />
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
