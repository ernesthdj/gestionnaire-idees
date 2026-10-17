import { useId, useState } from 'react'
import { parseCheckCommand } from '@shared/agents/checks'
import { Button } from '../../components/atoms/Button'

/**
 * Commandes de vérification proposées par l'Architecte (L2-pipeline-optimal D2, T001) : la liste exacte, à valider
 * telle quelle, à modifier (une par ligne) ou à refuser. Rien n'est lancé sans ce clic ; une commande qu'un shell
 * interpréterait est refusée d'office. Les validées ne sont plus redemandées pour ce projet.
 */
export function ChecksCard({
  checks,
  busy,
  onDecide
}: {
  readonly checks: readonly { readonly command: string; readonly problem: string | null }[]
  readonly busy: boolean
  readonly onDecide: (approved: boolean, commands?: readonly string[]) => void
}): React.JSX.Element {
  const fieldId = useId()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(checks.map((check) => check.command).join('\n'))
  const edited = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const problems = (editing ? edited : checks.map((check) => check.command)).flatMap((command) => {
    const parsed = parseCheckCommand(command)
    return parsed.ok ? [] : [`« ${command} » : ${parsed.reason}`]
  })
  const blocked = problems.length > 0 || (editing && edited.length === 0)
  return (
    <section
      aria-label="Commandes de vérification"
      className="space-y-2 rounded-md border border-accent/60 bg-surface-raised/40 p-3"
    >
      <h4 className="font-medium">Commandes de vérification</h4>
      <p className="text-content-muted">
        L’Architecte propose de vérifier le travail avec ces commandes, lancées par l’app dans le dossier de chaque
        développeur, sans shell. Les développeurs attendent ta décision.
      </p>
      {editing ? (
        <>
          <label htmlFor={fieldId} className="block text-content-muted">
            Une commande par ligne
          </label>
          <textarea
            id={fieldId}
            value={text}
            rows={Math.min(8, Math.max(3, edited.length + 1))}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-md border border-content-muted/40 bg-surface px-2 py-1 font-mono text-xs"
          />
        </>
      ) : (
        <ul className="space-y-1 font-mono text-xs">
          {checks.map((check) => (
            <li key={check.command} className="rounded bg-surface px-2 py-1">
              {check.command}
            </li>
          ))}
        </ul>
      )}
      {problems.length === 0 ? null : (
        <div role="alert">
          <ul className="space-y-1 text-con">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={busy || blocked}
          onClick={() => onDecide(true, editing ? edited : undefined)}
        >
          {editing ? 'Valider ces commandes' : 'Valider'}
        </Button>
        {editing ? null : (
          <Button disabled={busy} onClick={() => setEditing(true)}>
            Modifier
          </Button>
        )}
        <Button variant="danger" disabled={busy} onClick={() => onDecide(false)}>
          Refuser
        </Button>
      </div>
    </section>
  )
}
