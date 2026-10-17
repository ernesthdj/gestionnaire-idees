import { useId, useState } from 'react'
import type { AgentProfileView } from '@shared/agents/profile'
import type { AssemblySketchView } from '@shared/ipc/assemblies'
import type { WorkflowItem } from '../workflow/workflowTree'
import './agents.css'

/**
 * Équipes dont le nœud a disparu du Workflow (L1o D27) : un bandeau sur la carte les signale ; déplié, chacune se
 * rattache à une tâche (ou un lot) avec ses agents, ses liens et ses conversations.
 */
export function StrayTeams({
  teams,
  targets,
  profiles,
  onRelink
}: {
  readonly teams: readonly AssemblySketchView[]
  readonly targets: readonly WorkflowItem[]
  readonly profiles: readonly AgentProfileView[]
  readonly onRelink: (team: AssemblySketchView, to: string) => Promise<boolean>
}): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (teams.length === 0) return null
  const nameOf = (profileId: string): string =>
    profiles.find((profile) => profile.id === profileId)?.name ?? 'profil supprimé'
  return (
    <section className="stray-teams nodrag nowheel" aria-label="Équipes à rattacher">
      <button type="button" className="stray-teams-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden="true">⚠</span>
        {teams.length === 1
          ? '1 équipe d’agents a perdu sa tâche'
          : `${teams.length} équipes d’agents ont perdu leur tâche`}
        <span className="stray-teams-action">{open ? 'Masquer' : 'Rattacher…'}</span>
      </button>
      {!open ? null : (
        <ul className="stray-teams-list">
          {teams.map((team) => (
            <StrayTeam
              key={team.nodeId}
              names={team.agents.map((agent) => nameOf(agent.profileId))}
              targets={targets}
              onRelink={(to) => onRelink(team, to)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function StrayTeam({
  names,
  targets,
  onRelink
}: {
  readonly names: readonly string[]
  readonly targets: readonly WorkflowItem[]
  readonly onRelink: (to: string) => Promise<boolean>
}): React.JSX.Element {
  const selectId = useId()
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = targets.find((item) => item.key === target) ?? targets[0]
  return (
    <li className="space-y-2">
      <p className="font-medium">{names.join(', ')}</p>
      {chosen === undefined ? (
        <p className="text-content-muted">Aucune tâche libre pour l’accueillir.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            Rattacher {names.join(', ')} à
          </label>
          <select
            id={selectId}
            className="h-8 min-w-0 flex-1 rounded-md border border-content-muted/40 bg-surface px-2"
            value={chosen.key}
            onChange={(event) => setTarget(event.target.value)}
          >
            {targets.map((item) => (
              <option key={item.key} value={item.key}>
                {item.next === true ? '▶ ' : ''}
                {item.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="card-button card-button-primary"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void onRelink(chosen.key).finally(() => setBusy(false))
            }}
          >
            Rattacher
          </button>
        </div>
      )}
    </li>
  )
}
