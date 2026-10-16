import type { AgentPlace, AssemblyAgent } from '@shared/agents/pipeline'
import type { AgentProfileView } from '@shared/agents/profile'
import type { AssemblySketchView } from '@shared/ipc/assemblies'
import { wouldCycle } from './agentGraph'

/** Ce qui change dans un croquis : toujours un nouveau croquis, jamais une modification sur place. */
export type SketchEdit = (sketch: AssemblySketchView) => AssemblySketchView

/** Identifiant d'agent tiré du nom de son profil (`a-z`, `0-9`, `-`, 32 caractères au plus), unique parmi `taken`. */
export function agentIdFor(profileName: string, taken: ReadonlySet<string>): string {
  const base =
    profileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28) || 'agent'
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`
    if (!taken.has(id)) return id
  }
}

/**
 * Identifiant de tâche proposé pour un nœud : stable et valide. Nœud du Workflow (`wf:<genesis>:ttask:docs-taches-t001`,
 * L1o D14) : ce qui suit le genesis, sans ponctuation (`T-ttaskdocstachest001`) ; sinon le début de l'identifiant.
 */
export function defaultTaskId(nodeId: string): string {
  const tail = nodeId.split(':').slice(2).join('')
  const base = tail === '' ? nodeId.replace(/-/g, '').slice(0, 8) : tail.replace(/[^A-Za-z0-9]/g, '').slice(-40)
  return `T-${base}`
}

/** Croquis vide d'un nœud : le premier agent y est ajouté ensuite. */
export const emptySketch = (nodeId: string, genesisId: string): AssemblySketchView => ({
  nodeId,
  genesisId,
  taskId: defaultTaskId(nodeId),
  agents: [],
  links: []
})

export const addAgent =
  (profile: AgentProfileView): SketchEdit =>
  (sketch) => ({
    ...sketch,
    agents: [
      ...sketch.agents,
      {
        id: agentIdFor(profile.name, new Set(sketch.agents.map((agent) => agent.id))),
        profileId: profile.id
      }
    ]
  })

/** Retire un agent et les liens qui le touchent. */
export const removeAgent =
  (agentId: string): SketchEdit =>
  (sketch) => ({
    ...sketch,
    agents: sketch.agents.filter((agent) => agent.id !== agentId),
    links: sketch.links.filter((link) => link.from !== agentId && link.to !== agentId)
  })

/** `to` attend `from` ; sans effet si le lien existe déjà ou ferait une boucle. */
export const addLink =
  (from: string, to: string): SketchEdit =>
  (sketch) =>
    sketch.links.some((link) => link.from === from && link.to === to) || wouldCycle(sketch.links, from, to)
      ? sketch
      : { ...sketch, links: [...sketch.links, { from, to }] }

export const removeLink =
  (from: string, to: string): SketchEdit =>
  (sketch) => ({ ...sketch, links: sketch.links.filter((link) => !(link.from === from && link.to === to)) })

/** Modifie la part d'un agent : sa tâche, sa zone (texte vide : retirée). */
export const editAgent =
  (agentId: string, patch: { readonly task?: string; readonly zone?: readonly string[] }): SketchEdit =>
  (sketch) => ({
    ...sketch,
    agents: sketch.agents.map((agent): AssemblyAgent => {
      if (agent.id !== agentId) return agent
      const task = 'task' in patch ? patch.task : agent.task
      const zone = 'zone' in patch ? patch.zone : agent.zone
      return {
        id: agent.id,
        profileId: agent.profileId,
        ...(task === undefined || task.trim() === '' ? {} : { task }),
        ...(zone === undefined || zone.length === 0 ? {} : { zone }),
        ...(agent.place === undefined ? {} : { place: agent.place })
      }
    })
  })

/** Agent posé ailleurs sur la carte (L1o D13) : sa place, par rapport à son nœud, arrondie au pixel. */
export const placeAgent =
  (agentId: string, place: AgentPlace): SketchEdit =>
  (sketch) => ({
    ...sketch,
    agents: sketch.agents.map((agent) =>
      agent.id === agentId ? { ...agent, place: { x: Math.round(place.x), y: Math.round(place.y) } } : agent
    )
  })

/** Zone saisie à la main : un chemin par ligne ou séparés par des virgules. */
export const parseZone = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((path) => path.trim())
    .filter((path) => path !== '')

/** Agents que `agentId` peut encore attendre (ni lui-même, ni un lien existant, ni une boucle). */
export const waitableBy = (sketch: AssemblySketchView, agentId: string): string[] =>
  sketch.agents
    .map((agent) => agent.id)
    .filter(
      (id) =>
        id !== agentId &&
        !sketch.links.some((link) => link.from === id && link.to === agentId) &&
        !wouldCycle(sketch.links, id, agentId)
    )
