import { useId, useState } from 'react'
import type { Confidentiality } from '@shared/ipc/reprise'
import { Button } from '../components/atoms/Button'
import { call, IpcFailure } from '../lib/ipc'

const LABELS: Readonly<Record<Confidentiality, { readonly icon: string; readonly text: string }>> = {
  local: { icon: '🔒', text: 'Local uniquement' },
  claude: { icon: '☁', text: 'Claude autorisé' }
}

interface ConfidentialityBadgeProps {
  readonly genesisId: string
  readonly level: Confidentiality
  readonly onChanged: (level: Confidentiality) => void
}

/**
 * Niveau de confidentialité d'un projet repris, affiché en permanence (spec 017 FR-003) et modifiable : passer à
 * « Claude autorisé » demande une confirmation ; revenir à « Local uniquement » est immédiat, avec un rappel.
 */
export function ConfidentialityBadge({ genesisId, level, onChanged }: ConfidentialityBadgeProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const titleId = useId()
  const target: Confidentiality = level === 'local' ? 'claude' : 'local'

  const change = async (): Promise<void> => {
    try {
      const result = await call<{ readonly level: Confidentiality }>('reprise:setConfidentiality', {
        genesisId,
        level: target,
        ...(target === 'claude' ? { confirm: true } : {})
      })
      setOpen(false)
      setNotice(
        result.level === 'local'
          ? 'Plus rien de ce projet ne sera envoyé à Claude. Ce qui l’a déjà été ne peut pas être rappelé.'
          : null
      )
      onChanged(result.level)
    } catch (error) {
      setNotice(error instanceof IpcFailure ? error.message : 'Le niveau n’a pas pu être changé.')
    }
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        title="Confidentialité de ce projet repris : cliquer pour la changer"
        className={`self-start rounded-full px-2 py-0.5 font-semibold ${
          level === 'local' ? 'bg-pro/15 text-pro' : 'bg-accent/10 text-accent'
        }`}
      >
        <span aria-hidden="true">{LABELS[level].icon}</span> {LABELS[level].text}
      </button>
      {open ? (
        <section
          aria-labelledby={titleId}
          className="flex flex-col gap-2 rounded-lg border border-content-muted/30 bg-surface-raised p-2"
        >
          <h3 id={titleId} className="font-semibold">
            {target === 'claude' ? 'Autoriser Claude sur ce projet ?' : 'Repasser en « Local uniquement » ?'}
          </h3>
          <p>
            {target === 'claude'
              ? 'Le code, les noms et les chemins de ce projet pourront être envoyés à Claude (conversation, guide, analyse).'
              : 'Plus rien de ce projet ne sera envoyé à Claude ; le modèle local fera le travail d’IA.'}
          </p>
          <div className="flex gap-2">
            <Button variant={target === 'claude' ? 'danger' : 'primary'} onClick={() => void change()}>
              {target === 'claude' ? 'Autoriser Claude' : 'Repasser en local'}
            </Button>
            <Button onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </section>
      ) : null}
      {notice === null ? null : <p role="status">{notice}</p>}
    </div>
  )
}
