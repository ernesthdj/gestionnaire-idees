import { useQuery } from '@tanstack/react-query'
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useId, useMemo, useState } from 'react'
import type { SkillsView, SkillView } from '@shared/ipc/skills'
import { FAMILY_LABELS, SKILL_FAMILIES, type SkillFamily } from '@shared/skills/model'
import { useEffectiveSettings } from '../app/useAppSettings'
import { call, IpcFailure } from '../lib/ipc'
import {
  BranchNode,
  ClusterNode,
  FAMILY_ICONS,
  SkillNode,
  TrunkNode,
  type BranchNodeType,
  type ClusterNodeType,
  type SkillNodeType,
  type TrunkNodeType
} from './SkillNodes'
import { SkillPanel } from './SkillPanel'
import { layoutTree, type TreeGroup } from './skillTree'

const NODE_TYPES: NodeTypes = { skill: SkillNode, trunk: TrunkNode, branch: BranchNode, cluster: ClusterNode }
const CLUSTER_ID = 'cluster:plugin'
const ARIA_LABELS = {
  'node.a11yDescription.default': 'Entrée pour ouvrir la fiche du skill.',
  'node.a11yDescription.keyboardDisabled': 'Entrée pour ouvrir la fiche du skill.',
  'edge.a11yDescription.default': 'Un skill qui en appelle un autre.'
}

type TreeNode = SkillNodeType | TrunkNodeType | BranchNodeType | ClusterNodeType

const matches = (skill: SkillView, search: string): boolean => {
  const term = search.trim().toLowerCase()
  return term === '' || skill.name.includes(term) || skill.description.toLowerCase().includes(term)
}

/** Nœuds et liens de l'arbre (lot A : une branche par famille), à partir de la toile filtrée. */
function buildTree(
  view: SkillsView,
  families: ReadonlySet<SkillFamily>,
  search: string,
  pluginsOpen: boolean,
  selectedId: string | null,
  onToggleCluster: () => void
): { readonly nodes: TreeNode[]; readonly edges: Edge[] } {
  const visible = view.skills.filter((skill) => families.has(skill.family) && matches(skill, search))
  const collapsed = !pluginsOpen && search.trim() === ''
  const groups: TreeGroup[] = SKILL_FAMILIES.filter((family) => families.has(family)).map((family) => {
    const skills = visible.filter((skill) => skill.family === family).sort((a, b) => (a.name < b.name ? -1 : 1))
    const folded = family === 'plugin' && collapsed && skills.length > 0
    return { id: family, label: FAMILY_LABELS[family], items: folded ? [CLUSTER_ID] : skills.map((skill) => skill.id) }
  })
  const layout = layoutTree(groups)
  const nodes: TreeNode[] = [
    { id: 'trunk', type: 'trunk', position: layout.trunk, data: { count: visible.length }, selectable: false }
  ]
  const edges: Edge[] = []
  for (const group of groups) {
    const count = visible.filter((skill) => skill.family === group.id).length
    nodes.push({
      id: `branch:${group.id}`,
      type: 'branch',
      position: layout.labels.get(group.id) ?? { x: 0, y: 0 },
      data: { label: group.label, count },
      selectable: false
    })
    edges.push({ id: `trunk-${group.id}`, source: 'trunk', target: `branch:${group.id}`, selectable: false })
  }
  const byId = new Map(visible.map((skill) => [skill.id, skill]))
  for (const [id, position] of layout.items) {
    if (id === CLUSTER_ID) {
      nodes.push({
        id,
        type: 'cluster',
        position,
        data: { count: visible.filter((skill) => skill.family === 'plugin').length, onToggle: onToggleCluster },
        selectable: false
      })
      continue
    }
    const skill = byId.get(id)
    if (skill === undefined) continue
    nodes.push({
      id,
      type: 'skill',
      position,
      data: { skill, selected: id === selectedId },
      ariaLabel: `${skill.name}, skill ${FAMILY_LABELS[skill.family].toLowerCase()}${
        skill.hasScripts ? ', contient des scripts' : ''
      }${skill.damaged ? ', abîmé' : ''}`
    })
  }
  for (const link of view.links) {
    if (!layout.items.has(link.from) || !layout.items.has(link.to)) continue
    edges.push({
      id: `${link.from}->${link.to}`,
      source: link.from,
      target: link.to,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 1.5 },
      ariaLabel: `${link.from.split(':').at(-1) ?? ''} appelle ${link.to.split(':').at(-1) ?? ''}`
    })
  }
  return { nodes, edges }
}

function SkillsTree(): React.JSX.Element {
  const settings = useEffectiveSettings()
  const searchId = useId()
  const query = useQuery({ queryKey: ['skills'], queryFn: () => call<SkillsView>('skills:list') })
  const [families, setFamilies] = useState<ReadonlySet<SkillFamily>>(new Set(SKILL_FAMILIES))
  const [search, setSearch] = useState('')
  const [pluginsOpen, setPluginsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const view = query.data

  // Un skill disparu (dossier supprimé) referme sa fiche.
  useEffect(() => {
    if (selectedId !== null && view !== undefined && !view.skills.some((skill) => skill.id === selectedId)) {
      setSelectedId(null)
    }
  }, [view, selectedId])

  const tree = useMemo(
    () =>
      view === undefined
        ? { nodes: [], edges: [] }
        : buildTree(view, families, search, pluginsOpen, selectedId, () => setPluginsOpen(true)),
    [view, families, search, pluginsOpen, selectedId]
  )

  const counts = (family: SkillFamily): number => view?.skills.filter((skill) => skill.family === family).length ?? 0
  const toggle = (family: SkillFamily): void =>
    setFamilies((current) => {
      const next = new Set(current)
      if (next.has(family)) next.delete(family)
      else next.add(family)
      return next
    })

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 basis-[62%] flex-col">
        <div className="flex flex-wrap items-center gap-4 border-b border-content-muted/20 px-4 py-2 text-sm">
          <label htmlFor={searchId} className="sr-only">
            Chercher un skill
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Chercher un skill…"
            className="h-8 w-56 rounded-md border border-content-muted/30 bg-surface px-2"
          />
          <fieldset className="flex gap-3">
            <legend className="sr-only">Familles affichées</legend>
            {SKILL_FAMILIES.map((family) => (
              <label key={family} className="flex items-center gap-1">
                <input type="checkbox" checked={families.has(family)} onChange={() => toggle(family)} />
                <span aria-hidden="true">{FAMILY_ICONS[family]}</span> {FAMILY_LABELS[family]} ({counts(family)})
              </label>
            ))}
          </fieldset>
          {pluginsOpen ? (
            <button type="button" onClick={() => setPluginsOpen(false)} className="h-8 text-content-muted underline">
              Replier les plugins
            </button>
          ) : null}
        </div>
        <div className="relative min-h-0 flex-1">
          {query.isError ? (
            <p role="alert" className="p-8 text-center text-sm">
              {query.error instanceof IpcFailure ? query.error.message : 'Les skills n’ont pas pu être lus.'}
            </p>
          ) : view === undefined ? (
            <p className="p-8 text-center text-sm text-content-muted">Lecture des skills…</p>
          ) : view.skills.length === 0 ? (
            <p className="p-8 text-center text-sm text-content-muted">
              Aucun skill trouvé : ni dans <code>~/.claude/skills</code>, ni dans les projets liés, ni dans les plugins.
            </p>
          ) : (
            <ReactFlow<TreeNode, Edge>
              nodes={tree.nodes}
              edges={tree.edges}
              nodeTypes={NODE_TYPES}
              nodeOrigin={[0.5, 0.5]}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              minZoom={0.1}
              maxZoom={1.5}
              colorMode={settings.theme}
              ariaLabelConfig={ARIA_LABELS}
              proOptions={{ hideAttribution: true }}
              onNodeClick={(_event, node) => {
                if (node.type === 'skill') setSelectedId(node.id)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const id = (event.target as HTMLElement).closest('[data-id]')?.getAttribute('data-id')
                if (id !== null && id !== undefined && view.skills.some((skill) => skill.id === id)) setSelectedId(id)
              }}
              onPaneClick={() => setSelectedId(null)}
            >
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>
      </div>
      <aside className="min-w-0 basis-[38%] border-l border-content-muted/20 bg-surface">
        {selectedId !== null && view !== undefined ? (
          <SkillPanel
            key={selectedId}
            skillId={selectedId}
            view={view}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <p className="p-8 text-center text-sm text-content-muted">
            Choisis un skill dans l’arbre pour ouvrir sa fiche.
          </p>
        )}
      </aside>
    </div>
  )
}

/** Page Skills (spec 020 US1) : l'arbre de compétences des skills de Claude Code, en lecture seule. */
export function SkillsPage(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <SkillsTree />
    </ReactFlowProvider>
  )
}
