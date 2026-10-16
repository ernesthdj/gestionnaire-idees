import { useState } from 'react'
import { routeLot, type LotRoute, type RoutedTask } from '@shared/agents/lotPlan'
import type { AgentProfileView } from '@shared/agents/profile'
import type { AssemblySketchView } from '@shared/ipc/assemblies'
import { Button } from '../../components/atoms/Button'
import { wouldCycle } from './agentGraph'

const RHYTHM_LABELS = { 'une-a-une': 'une à une', tout: 'tout le lot' } as const

/**
 * Aiguillage du lot (L1o D25, T023) : pour chaque tâche du plan du PO, les agents de l'équipe qui interviennent et qui
 * attend qui. Marqué ✦ quand il vient du PO, « retouché » quand mentalyas l'a changé (son choix prime) ; « Rendre au
 * PO » efface la retouche. Les profils que le PO nomme sans qu'aucun agent de l'équipe les porte sont signalés.
 */
export function LotRouting({
  sketch,
  profiles,
  disabled,
  onRoute
}: {
  readonly sketch: AssemblySketchView
  readonly profiles: readonly AgentProfileView[]
  readonly disabled: boolean
  readonly onRoute: (task: string, route: Omit<LotRoute, 'task'> | null) => void
}): React.JSX.Element | null {
  const [editing, setEditing] = useState<string | null>(null)
  if (sketch.lot === undefined) return null
  const nameOf = (agentId: string): string => {
    const agent = sketch.agents.find((entry) => entry.id === agentId)
    return profiles.find((profile) => profile.id === agent?.profileId)?.name ?? agentId
  }
  const team = sketch.agents.map((agent) => ({ id: agent.id, name: nameOf(agent.id) }))
  const routes = routeLot(sketch.lot, team)
  const { rhythm } = sketch.lot.plan
  return (
    <section aria-label="Aiguillage du lot" className="space-y-2">
      <h3 className="font-medium">Aiguillage du lot</h3>
      {rhythm === null ? null : (
        <p className="rounded-md bg-surface-raised p-2">
          <span className="text-accent" aria-hidden="true">
            ✦{' '}
          </span>
          Le PO conseille : <strong>{RHYTHM_LABELS[rhythm.mode]}</strong>
          {rhythm.reason === '' ? '' : ` — ${rhythm.reason}`}
        </p>
      )}
      {routes.length === 0 ? (
        <p className="text-content-muted">Le PO n’a aiguillé aucune tâche dans sa spec.</p>
      ) : (
        <ul className="space-y-2">
          {routes.map((route) =>
            editing === route.task ? (
              <RouteEditor
                key={route.task}
                route={route}
                team={team}
                onCancel={() => setEditing(null)}
                onSave={(next) => {
                  setEditing(null)
                  onRoute(route.task, next)
                }}
              />
            ) : (
              <li key={route.task} className="rounded-md border border-content-muted/30 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{route.task}</strong>
                  <span className={route.byHand ? 'text-content-muted' : 'text-accent'}>
                    {route.byHand ? 'retouché' : '✦ plan du PO'}
                  </span>
                  <span className="flex-1" />
                  {disabled ? null : (
                    <>
                      <Button onClick={() => setEditing(route.task)}>Modifier</Button>
                      {route.byHand ? <Button onClick={() => onRoute(route.task, null)}>Rendre au PO</Button> : null}
                    </>
                  )}
                </div>
                <p className="mt-1">
                  {route.agents.length === 0 ? 'Aucun agent de l’équipe.' : route.agents.map(nameOf).join(', ')}
                </p>
                {route.links.length === 0 ? null : (
                  <p className="text-content-muted">
                    {route.links.map((link) => `${nameOf(link.to)} attend ${nameOf(link.from)}`).join(' · ')}
                  </p>
                )}
                {route.missing.length === 0 ? null : (
                  <p className="text-idea">Pas dans l’équipe : {route.missing.join(', ')} (à connecter ou à créer).</p>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </section>
  )
}

/** Retouche d'une tâche : qui intervient (cases), et pour chacun qui il attend parmi les autres cochés. */
function RouteEditor({
  route,
  team,
  onCancel,
  onSave
}: {
  readonly route: RoutedTask
  readonly team: readonly { readonly id: string; readonly name: string }[]
  readonly onCancel: () => void
  readonly onSave: (route: Omit<LotRoute, 'task'>) => void
}): React.JSX.Element {
  const [agents, setAgents] = useState<readonly string[]>(route.agents)
  const [links, setLinks] = useState<LotRoute['links']>(route.links)
  const kept = links.filter((link) => agents.includes(link.from) && agents.includes(link.to))
  const toggle = (id: string): void =>
    setAgents((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))
  const waits = (id: string, from: string): boolean => kept.some((link) => link.from === from && link.to === id)
  const setWait = (id: string, from: string, on: boolean): void =>
    setLinks((current) =>
      on ? [...current, { from, to: id }] : current.filter((link) => !(link.from === from && link.to === id))
    )
  return (
    <li className="space-y-2 rounded-md border border-accent/60 p-2">
      <strong>{route.task}</strong>
      <fieldset className="space-y-1">
        <legend className="text-content-muted">Qui intervient, et qui il attend</legend>
        {team.map((agent) => (
          <div key={agent.id} className="space-y-1">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={agents.includes(agent.id)} onChange={() => toggle(agent.id)} />
              {agent.name}
            </label>
            {!agents.includes(agent.id) ? null : (
              <div className="ml-6 flex flex-wrap gap-x-3">
                {team
                  .filter((other) => other.id !== agent.id && agents.includes(other.id))
                  .map((other) => (
                    <label key={other.id} className="flex items-center gap-1 text-content-muted">
                      <input
                        type="checkbox"
                        checked={waits(agent.id, other.id)}
                        disabled={!waits(agent.id, other.id) && wouldCycle(kept, other.id, agent.id)}
                        onChange={(event) => setWait(agent.id, other.id, event.target.checked)}
                      />
                      attend {other.name}
                    </label>
                  ))}
              </div>
            )}
          </div>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button variant="primary" disabled={agents.length === 0} onClick={() => onSave({ agents, links: kept })}>
          Enregistrer
        </Button>
        <Button onClick={onCancel}>Annuler</Button>
      </div>
    </li>
  )
}
