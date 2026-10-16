import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { PASS_NATURE_LABELS, UNCOMMITTED_MARK, type AssemblyAgent, type CleanupResult } from '@shared/agents/pipeline'
import { AGENT_PERMISSION_LABELS, AGENT_ROLE_LABELS, type AgentProfileView } from '@shared/agents/profile'
import type { AssemblyRunView, AssemblySketchView } from '@shared/ipc/assemblies'
import type { WorkflowView } from '@shared/ipc/workflow'
import { Markdown } from '../../chat/Markdown'
import { Button } from '../../components/atoms/Button'
import { call, IpcFailure } from '../../lib/ipc'
import { agentsTitle, useSidePanel, type AgentsTab } from '../side/sidePanelStore'
import { workflowTree } from '../workflow/workflowTree'
import { AGENT_VISUAL_LABELS, assemblyProgress, runOf, visualOf } from './agentGraph'
import {
  addAgent,
  addLink,
  editAgent,
  emptySketch,
  parseZone,
  removeAgent,
  removeLink,
  waitableBy,
  type SketchEdit
} from './sketchEdit'
import { LotRouting } from './LotRouting'
import { useAssemblyActions, useAssemblyData } from './useAssemblies'

const FIELD = 'h-8 w-full rounded-md border border-content-muted/30 bg-surface px-2 text-sm'
const AREA = 'w-full rounded-md border border-content-muted/30 bg-surface px-2 py-1 text-sm'

/** Part d'un agent dans l'assemblage : ce qu'il lit comme mission. */
export const missionOf = (agent: AssemblyAgent, alone: boolean): string =>
  agent.task?.trim() || (alone ? 'La tâche et le contexte du nœud.' : 'Sa part de la spec signée du Product Owner.')

/**
 * Volet des agents d'un nœud (T006, L1o D10), dans le panneau de droite : l'assemblage dessiné sur la carte (agents,
 * qui attend qui), son lancement, son suivi, l'accord unique de fusion ; et, pour l'agent choisi, son profil, sa passe,
 * sa mission et son rapport. Tout se modifie ici comme sur la carte (les liens se tirent entre les nœuds ou se
 * choisissent dans la liste) ; rien n'est lancé sans le geste de mentalyas.
 */
export function AgentsTabContent({ tab }: { readonly tab: AgentsTab }): React.JSX.Element {
  const ids = { task: useId(), brief: useId(), profile: useId(), base: useId() }
  const { sketches, runs, profiles } = useAssemblyData()
  const actions = useAssemblyActions()
  const selectAgent = useSidePanel((state) => state.selectAgent)
  const sketch = sketches.find((entry) => entry.nodeId === tab.nodeId)
  const run = sketch === undefined ? undefined : runOf(sketch, runs)
  const running = run?.state === 'running'
  const [profileId, setProfileId] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [pending, setPending] = useState<readonly string[] | null>(null)
  const [confirmMerge, setConfirmMerge] = useState(false)
  const [busy, setBusy] = useState(false)
  // Après la fusion (L1o D23) : le rangement des branches des agents, et son résultat.
  const [cleaned, setCleaned] = useState<CleanupResult | string | null>(null)

  const edit = async (change: SketchEdit): Promise<void> => {
    const next = change(sketch ?? emptySketch(tab.nodeId, tab.genesisId))
    // Le dernier agent retiré : le croquis du nœud s'efface (un croquis a toujours au moins un agent).
    if (next.agents.length === 0) await actions.clear(tab.nodeId)
    else await actions.save(next)
  }
  const profileOf = (agent: AssemblyAgent): AgentProfileView | undefined =>
    profiles.find((profile) => profile.id === agent.profileId)
  const chosen = profiles.find((profile) => profile.id === profileId) ?? profiles[0]

  const launch = async (confirmed: boolean): Promise<void> => {
    if (sketch === undefined || busy) return
    setBusy(true)
    try {
      if (!confirmed) {
        const found = await actions.warnings(sketch, baseBranch)
        if (found === null) return
        if (found.length > 0) {
          setPending(found)
          return
        }
      }
      setPending(null)
      await actions.start(sketch, baseBranch)
    } finally {
      setBusy(false)
    }
  }
  const merge = async (): Promise<void> => {
    if (run === undefined || busy) return
    setBusy(true)
    setConfirmMerge(false)
    try {
      await actions.approve(run.genesisId, run.taskId)
    } finally {
      setBusy(false)
    }
  }

  const cleanup = async (): Promise<void> => {
    if (run === undefined || busy) return
    setBusy(true)
    try {
      setCleaned(await call<CleanupResult>('assembly:cleanup', { genesisId: run.genesisId, taskId: run.taskId }))
    } catch (failure) {
      setCleaned(failure instanceof IpcFailure ? failure.message : 'Les branches n’ont pas pu être rangées.')
    } finally {
      setBusy(false)
    }
  }

  const selected = sketch?.agents.find((agent) => agent.id === tab.agentId)
  const progress = assemblyProgress(run)
  const validated = run?.state === 'finished' && run.result?.completed === true

  return (
    <div className="side-body side-body-padded space-y-4 text-sm" data-testid="agents-tab">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">Agents · {tab.title.replace(/^◇ /, '')}</h2>
        <p className="text-content-muted">
          Les agents connectés à ce nœud lisent son contexte. Un lien « attend » met un agent à la suite d’un autre ;
          sans lien, ils travaillent en même temps.
        </p>
      </header>

      <section aria-label="Tâche" className="space-y-2">
        <label htmlFor={ids.task} className="block font-medium">
          Identifiant de la tâche
        </label>
        <input
          key={sketch?.taskId ?? 'new'}
          id={ids.task}
          className={FIELD}
          defaultValue={sketch?.taskId ?? ''}
          placeholder="ex. T006"
          maxLength={64}
          disabled={running || sketch === undefined}
          onBlur={(event) => {
            const taskId = event.target.value.trim()
            if (sketch !== undefined && taskId !== '' && taskId !== sketch.taskId)
              void actions.save({ ...sketch, taskId })
          }}
        />
        <label htmlFor={ids.brief} className="block font-medium">
          Ce qui est demandé (facultatif)
        </label>
        <textarea
          key={`${sketch?.taskId ?? 'new'}-brief`}
          id={ids.brief}
          className={AREA}
          rows={2}
          maxLength={4000}
          defaultValue={sketch?.task ?? ''}
          disabled={running || sketch === undefined}
          onBlur={(event) => {
            if (sketch === undefined || event.target.value === (sketch.task ?? '')) return
            const { nodeId, genesisId, taskId, agents, links } = sketch
            const task = event.target.value
            void actions.save({ nodeId, genesisId, taskId, agents, links, ...(task.trim() === '' ? {} : { task }) })
          }}
        />
      </section>

      <section aria-label="Agents de l’assemblage" className="space-y-2">
        <h3 className="font-medium">Agents ({sketch?.agents.length ?? 0})</h3>
        {sketch === undefined || sketch.agents.length === 0 ? (
          <p className="text-content-muted">Aucun agent. Ajoute-en un : il apparaît sous le nœud sur la carte.</p>
        ) : (
          <ul className="space-y-1">
            {sketch.agents.map((agent) => {
              const live = run?.agents.find((entry) => entry.agentId === agent.id)
              const profile = profileOf(agent)
              const visual = visualOf(run, live)
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    aria-pressed={tab.agentId === agent.id}
                    onClick={() => selectAgent(tab.nodeId, tab.agentId === agent.id ? null : agent.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left hover:bg-surface-raised ${
                      tab.agentId === agent.id ? 'border-focus' : 'border-content-muted/30'
                    }`}
                  >
                    <span className="truncate font-medium">{profile?.name ?? agent.id}</span>
                    <span className="shrink-0 text-xs text-content-muted">
                      {profile === undefined ? 'profil introuvable' : AGENT_ROLE_LABELS[profile.role]} ·{' '}
                      {AGENT_VISUAL_LABELS[visual]}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {running ? null : (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={ids.profile} className="block font-medium">
                Ajouter un agent
              </label>
              <select
                id={ids.profile}
                className={FIELD}
                value={chosen?.id ?? ''}
                disabled={profiles.length === 0}
                onChange={(event) => setProfileId(event.target.value)}
              >
                {profiles.length === 0 ? <option value="">Aucun profil</option> : null}
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({AGENT_ROLE_LABELS[profile.role]})
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              disabled={chosen === undefined}
              onClick={() => chosen !== undefined && void edit(addAgent(chosen))}
            >
              Ajouter
            </Button>
          </div>
        )}
        {profiles.length === 0 ? (
          <p className="text-xs text-content-muted">Crée d’abord des profils : page Skills › Profils d’agents.</p>
        ) : null}
      </section>

      {sketch === undefined || sketch.agents.length === 0 ? null : (
        <section aria-label="Qui attend qui" className="space-y-2">
          <h3 className="font-medium">Qui attend qui</h3>
          <ul className="space-y-1">
            {sketch.agents.map((agent) => (
              <WaitRow
                key={agent.id}
                sketch={sketch}
                agent={agent}
                disabled={running}
                onAdd={(from) => void edit(addLink(from, agent.id))}
                onRemove={(from) => void edit(removeLink(from, agent.id))}
              />
            ))}
          </ul>
          <p className="text-xs text-content-muted">
            Tu peux aussi tirer un lien d’un agent à l’autre sur la carte (de la poignée du bas vers celle du haut).
          </p>
        </section>
      )}

      {sketch?.lot === undefined ? null : (
        <LotRouting
          sketch={sketch}
          profiles={profiles}
          disabled={running}
          onRoute={(task, route) => void actions.route(sketch.nodeId, task, route)}
        />
      )}

      {sketch === undefined || sketch.agents.length === 0 ? null : (
        <section aria-label="Lancement" className="space-y-2">
          <h3 className="font-medium">Travail</h3>
          {run === undefined ? null : (
            <div className="space-y-1">
              <div
                role="progressbar"
                aria-label="Agents qui ont fini"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                className="h-2 overflow-hidden rounded bg-content-muted/20"
              >
                <div
                  className={`h-full ${validated ? 'bg-pro' : run.state === 'failed' ? 'bg-con' : 'bg-accent'}`}
                  style={{ width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p aria-live="polite">
                {progress.done} agent{progress.done > 1 ? 's' : ''} sur {progress.total}{' '}
                {progress.done > 1 ? 'ont' : 'a'} fini
                {run.state === 'running'
                  ? ' — au travail.'
                  : validated
                    ? ' — validé par le QA.'
                    : run.state === 'failed'
                      ? ` — le planificateur a échoué : ${run.error ?? 'erreur inattendue'}`
                      : ' — arrêté, sans validation.'}
              </p>
            </div>
          )}
          {running ? null : (
            <div>
              <label htmlFor={ids.base} className="block font-medium">
                Branche de base
              </label>
              <input
                id={ids.base}
                className={FIELD}
                value={baseBranch}
                placeholder="main"
                maxLength={100}
                onChange={(event) => setBaseBranch(event.target.value)}
              />
            </div>
          )}
          {pending === null ? null : (
            <div role="alert" className="space-y-2 rounded-md border border-idea/60 p-2">
              <p className="font-medium">Avant de lancer :</p>
              <ul className="list-disc space-y-1 pl-4">
                {pending.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              {pending.some((warning) => warning.startsWith(UNCOMMITTED_MARK)) ? (
                <Button onClick={() => useSidePanel.getState().openRepo(tab.genesisId)}>Ouvrir le Dépôt</Button>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => run !== undefined && void actions.cancel(run.genesisId, run.taskId)}
              >
                Arrêter
              </Button>
            ) : pending === null ? (
              <Button variant="primary" disabled={busy} onClick={() => void launch(false)}>
                {run === undefined ? 'Lancer' : 'Relancer'}
              </Button>
            ) : (
              <>
                <Button variant="primary" disabled={busy} onClick={() => void launch(true)}>
                  Lancer quand même
                </Button>
                <Button onClick={() => setPending(null)}>Annuler</Button>
              </>
            )}
            {running || sketch === undefined || sketch.agents.length === 0 ? null : (
              <MoveTeam sketch={sketch} disabled={busy} />
            )}
            {running || sketch === undefined ? null : (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setPending(null)
                  void actions.clear(sketch.nodeId)
                }}
              >
                Retirer les agents
              </Button>
            )}
          </div>
          {validated && run?.approval?.merged !== true ? (
            confirmMerge ? (
              <div role="alert" className="space-y-2 rounded-md border border-pro/60 p-2">
                <p>
                  Fusionner le travail validé sur <strong>{baseBranch.trim() || 'main'}</strong> ? La branche de base
                  avance d’un coup ; un conflit arrête tout sans rien changer.
                </p>
                <div className="flex gap-2">
                  <Button variant="primary" disabled={busy} onClick={() => void merge()}>
                    Accorder la fusion
                  </Button>
                  <Button onClick={() => setConfirmMerge(false)}>Garder</Button>
                </div>
              </div>
            ) : (
              <Button variant="primary" disabled={busy} onClick={() => setConfirmMerge(true)}>
                Fusionner le travail validé…
              </Button>
            )
          ) : null}
          {run?.approval === undefined ? null : (
            <p role="status" className={run.approval.merged ? 'text-pro' : 'text-con'}>
              {run.approval.merged
                ? `Fusionné sur ${run.approval.baseBranch}${run.approval.commit === undefined ? '' : ` (${run.approval.commit.slice(0, 7)})`}.${run.approval.checked === true ? ' Tâche cochée.' : ''}`
                : `Fusion refusée : ${run.approval.message ?? 'raison inconnue'}.`}
            </p>
          )}
          {run?.approval?.merged !== true ? null : (
            // La suite (L1o D23) : la fusion reste locale ; pousser se fait dans le Dépôt, puis on range les branches.
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => useSidePanel.getState().openRepo(tab.genesisId)}>
                  Pousser…
                </Button>
                <Button disabled={busy || cleaned !== null} onClick={() => void cleanup()}>
                  Ranger les branches des agents
                </Button>
              </div>
              {cleaned === null ? null : typeof cleaned === 'string' ? (
                <p role="alert" className="text-con">
                  {cleaned}
                </p>
              ) : (
                <p role="status" className="text-content-muted">
                  {cleaned.removed.length === 0
                    ? 'Aucune branche à ranger.'
                    : `${cleaned.removed.length} branche(s) rangée(s).`}
                  {cleaned.kept.length === 0 ? '' : ` Gardée(s), non fusionnée(s) : ${cleaned.kept.join(', ')}.`}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {sketch === undefined || selected === undefined ? null : (
        <AgentDetail
          key={selected.id}
          sketch={sketch}
          agent={selected}
          profile={profileOf(selected)}
          run={run}
          editable={!running}
          onEdit={(change) => void edit(change)}
        />
      )}
    </div>
  )
}

/** Ce qu'attend un agent : ses puces (retirables) et le choix d'un autre agent à attendre. */
function WaitRow({
  sketch,
  agent,
  disabled,
  onAdd,
  onRemove
}: {
  readonly sketch: AssemblySketchView
  readonly agent: AssemblyAgent
  readonly disabled: boolean
  readonly onAdd: (from: string) => void
  readonly onRemove: (from: string) => void
}): React.JSX.Element {
  const id = useId()
  const waits = sketch.links.filter((link) => link.to === agent.id).map((link) => link.from)
  const candidates = waitableBy(sketch, agent.id)
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{agent.id}</span>
      <span className="text-content-muted">{waits.length === 0 ? 'part tout de suite' : 'attend'}</span>
      {waits.map((from) => (
        <span key={from} className="inline-flex items-center gap-1 rounded bg-surface-raised px-2 py-0.5">
          {from}
          {disabled ? null : (
            <button
              type="button"
              aria-label={`${agent.id} n’attend plus ${from}`}
              className="text-content-muted hover:text-content"
              onClick={() => onRemove(from)}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {disabled || candidates.length === 0 ? null : (
        <>
          <label htmlFor={id} className="sr-only">
            Faire attendre {agent.id}
          </label>
          <select
            id={id}
            className="h-7 rounded-md border border-content-muted/30 bg-surface px-1 text-xs"
            value=""
            onChange={(event) => event.target.value !== '' && onAdd(event.target.value)}
          >
            <option value="">+ attend…</option>
            {candidates.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </>
      )}
    </li>
  )
}

/** Volet d'un agent : profil, état, passe, sa part (tâche, zone), puis l'échange mission → rapport. */
function AgentDetail({
  sketch,
  agent,
  profile,
  run,
  editable,
  onEdit
}: {
  readonly sketch: AssemblySketchView
  readonly agent: AssemblyAgent
  readonly profile: AgentProfileView | undefined
  readonly run: AssemblyRunView | undefined
  readonly editable: boolean
  readonly onEdit: (change: SketchEdit) => void
}): React.JSX.Element {
  const ids = { task: useId(), zone: useId() }
  const live = run?.agents.find((entry) => entry.agentId === agent.id)
  const visual = visualOf(run, live)
  const alone = sketch.agents.length === 1
  return (
    <section aria-label={`Agent ${agent.id}`} className="space-y-3 border-t border-content-muted/20 pt-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{profile?.name ?? agent.id}</h3>
          <p className="text-content-muted">
            {profile === undefined
              ? 'Le profil de cet agent n’existe plus (page Skills).'
              : `${AGENT_ROLE_LABELS[profile.role]} · ${profile.model} · ${AGENT_PERMISSION_LABELS[profile.permissionMode]}`}
          </p>
        </div>
        {editable ? (
          <Button variant="danger" onClick={() => onEdit(removeAgent(agent.id))}>
            Retirer
          </Button>
        ) : null}
      </div>
      <p aria-live="polite">
        <span className="font-medium">{AGENT_VISUAL_LABELS[visual]}</span>
        {live?.pass === undefined
          ? null
          : ` — passe ${live.pass}${live.nature === undefined ? '' : ` (${PASS_NATURE_LABELS[live.nature]})`}${
              live.specVersion === undefined ? '' : `, spec v${live.specVersion}`
            }`}
        {live?.verdict === undefined ? null : ` — verdict : ${live.verdict === 'valide' ? 'valide' : 'renvoi'}`}
      </p>
      {live?.message === undefined ? null : (
        <p role="alert" className="text-con">
          {live.message}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor={ids.task} className="block font-medium">
          Sa part (facultatif)
        </label>
        <textarea
          id={ids.task}
          className={AREA}
          rows={2}
          maxLength={4000}
          defaultValue={agent.task ?? ''}
          disabled={!editable}
          onBlur={(event) =>
            event.target.value !== (agent.task ?? '') && onEdit(editAgent(agent.id, { task: event.target.value }))
          }
        />
        <label htmlFor={ids.zone} className="block font-medium">
          Zone de travail (un chemin par ligne)
        </label>
        <textarea
          id={ids.zone}
          className={AREA}
          rows={2}
          defaultValue={(agent.zone ?? []).join('\n')}
          placeholder="src/liste"
          disabled={!editable}
          onBlur={(event) => {
            const zone = parseZone(event.target.value)
            if (zone.join('\n') !== (agent.zone ?? []).join('\n')) onEdit(editAgent(agent.id, { zone }))
          }}
        />
      </div>

      <div className="space-y-2" aria-label="Échange avec l’agent">
        <h4 className="font-medium">Mission</h4>
        <p className="rounded-md bg-surface-raised p-2">{missionOf(agent, alone)}</p>
        <h4 className="font-medium">Rapport</h4>
        {live?.report === undefined ? (
          <p className="text-content-muted">Pas encore de rapport : il arrive quand l’agent a fini sa passe.</p>
        ) : (
          <div className="rounded-md border border-content-muted/20 p-2">
            <Markdown text={live.report} />
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * « Déplacer l'équipe… » (L1o D24) : les tâches du Workflow du projet, la prochaine en tête ; ni les tâches faites, ni
 * celles qui ont déjà des agents. L'équipe y part avec ses agents et ses liens, le volet suit.
 */
function MoveTeam({
  sketch,
  disabled
}: {
  readonly sketch: AssemblySketchView
  readonly disabled: boolean
}): React.JSX.Element {
  const selectId = useId()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')
  const { sketches } = useAssemblyData()
  const actions = useAssemblyActions()
  const openAgents = useSidePanel((state) => state.openAgents)
  const view = useQuery({
    queryKey: ['workflow', sketch.genesisId],
    queryFn: () => call<WorkflowView>('workflow:read', { genesisId: sketch.genesisId }),
    enabled: open
  })
  const busy = new Set(sketches.filter((entry) => entry.agents.length > 0).map((entry) => entry.nodeId))
  const tasks =
    view.data === undefined
      ? []
      : workflowTree({ view: view.data }, sketch.genesisId)
          .items.filter(
            (item) =>
              item.key.split(':')[2] === 'ttask' &&
              item.status !== 'done' &&
              item.key !== sketch.nodeId &&
              !busy.has(item.key)
          )
          .sort((a, b) => Number(b.next === true) - Number(a.next === true))
  const chosen = tasks.find((item) => item.key === target) ?? tasks[0]
  const move = async (): Promise<void> => {
    if (chosen === undefined) return
    if (await actions.move(sketch.nodeId, chosen.key)) {
      setOpen(false)
      openAgents({
        nodeId: chosen.key,
        genesisId: sketch.genesisId,
        title: agentsTitle(chosen.title),
        kindLabel: 'Agents'
      })
    }
  }
  if (!open) {
    return (
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        Déplacer l’équipe…
      </Button>
    )
  }
  return (
    <div className="w-full space-y-2 rounded-md border border-content-muted/30 p-2">
      <label htmlFor={selectId} className="block font-medium">
        Vers quelle tâche ?
      </label>
      {view.isLoading ? (
        <p className="text-content-muted">Lecture du Workflow…</p>
      ) : tasks.length === 0 ? (
        <p className="text-content-muted">Aucune autre tâche à faire sans agents dans ce projet.</p>
      ) : (
        <select
          id={selectId}
          className="w-full rounded-md border border-content-muted/40 bg-surface px-2 py-1"
          value={chosen?.key ?? ''}
          onChange={(event) => setTarget(event.target.value)}
        >
          {tasks.map((item) => (
            <option key={item.key} value={item.key}>
              {item.next === true ? '▶ ' : ''}
              {item.title}
            </option>
          ))}
        </select>
      )}
      <p className="text-content-muted">
        Les agents et leurs liens suivent ; ce qui était demandé, la part et la zone de chacun restent à l’ancienne
        tâche.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" disabled={disabled || chosen === undefined} onClick={() => void move()}>
          Déplacer
        </Button>
        <Button onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </div>
  )
}
