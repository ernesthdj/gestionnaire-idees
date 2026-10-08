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
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { LibraryRepoView, LibrarySkillView, SkillDraftView, SkillsView, SkillView } from '@shared/ipc/skills'
import { FAMILY_LABELS, SKILL_FAMILIES, type SkillFamily } from '@shared/skills/model'
import { useEffectiveSettings } from '../app/useAppSettings'
import { call, IpcFailure } from '../lib/ipc'
import {
  AvailableNode,
  BranchNode,
  ClusterNode,
  FAMILY_ICONS,
  GhostNode,
  LIBRARY_ICON,
  RepoNode,
  SkillNode,
  TrunkNode,
  VERDICTS,
  type AvailableNodeType,
  type BranchNodeType,
  type ClusterNodeType,
  type GhostNodeType,
  type RepoNodeType,
  type SkillNodeType,
  type TrunkNodeType
} from './SkillNodes'
import { DraftPanel } from './DraftPanel'
import { ImportDialog } from './ImportDialog'
import { LibraryRepoPanel, LibrarySkillPanel, repoLabel } from './LibraryPanel'
import { SkillConversation, SkillPanel } from './SkillPanel'
import { layoutTree, type TreeGroup } from './skillTree'

const NODE_TYPES: NodeTypes = {
  skill: SkillNode,
  trunk: TrunkNode,
  branch: BranchNode,
  cluster: ClusterNode,
  ghost: GhostNode,
  repo: RepoNode,
  available: AvailableNode
}
const CLUSTER_ID = 'cluster:plugin'
const ARIA_LABELS = {
  'node.a11yDescription.default': 'Entrée pour ouvrir la fiche du skill.',
  'node.a11yDescription.keyboardDisabled': 'Entrée pour ouvrir la fiche du skill.',
  'edge.a11yDescription.default': 'Un skill qui en appelle un autre.'
}

type TreeNode =
  SkillNodeType | TrunkNodeType | BranchNodeType | ClusterNodeType | GhostNodeType | RepoNodeType | AvailableNodeType
const GHOST_PREFIX = 'draft:'
/** Bibliothèque (D12) : un dépôt (`repo:<id>`) et ses skills disponibles (`lib:<candidateId>`). */
const REPO_PREFIX = 'repo:'
const LIB_PREFIX = 'lib:'
const LIBRARY_GROUP = 'library'

const matches = (skill: Pick<SkillView, 'name' | 'description'>, search: string): boolean => {
  const term = search.trim().toLowerCase()
  return term === '' || skill.name.includes(term) || skill.description.toLowerCase().includes(term)
}

interface TreeInput {
  readonly view: SkillsView
  readonly ghosts: readonly SkillDraftView[]
  /** Dépôts de la bibliothèque affichés (vide si la branche est masquée). */
  readonly library: readonly LibraryRepoView[]
  readonly families: ReadonlySet<SkillFamily>
  readonly search: string
  readonly pluginsOpen: boolean
  readonly openRepos: ReadonlySet<string>
  readonly selectedId: string | null
  readonly onToggleCluster: () => void
}

/** Nœuds et liens de l'arbre (une branche par famille, plus la Bibliothèque), à partir de la toile filtrée. */
function buildTree(input: TreeInput): { readonly nodes: TreeNode[]; readonly edges: Edge[] } {
  const { view, ghosts, library, families, search, pluginsOpen, openRepos, selectedId, onToggleCluster } = input
  const visible = view.skills.filter((skill) => families.has(skill.family) && matches(skill, search))
  const collapsed = !pluginsOpen && search.trim() === ''
  const groups: TreeGroup[] = SKILL_FAMILIES.filter((family) => families.has(family)).map((family) => {
    const skills = visible.filter((skill) => skill.family === family).sort((a, b) => (a.name < b.name ? -1 : 1))
    const folded = family === 'plugin' && collapsed && skills.length > 0
    const drafts = ghosts.filter((draft) => draft.family === family).map((draft) => `${GHOST_PREFIX}${draft.id}`)
    return {
      id: family,
      label: FAMILY_LABELS[family],
      items: [...drafts, ...(folded ? [CLUSTER_ID] : skills.map((skill) => skill.id))]
    }
  })
  // Une recherche déplie les dépôts pour montrer leurs skills qui correspondent.
  const libraryVisible = library.map((repo) => ({
    repo,
    skills: repo.skills.filter((skill) => matches(skill, search)),
    open: openRepos.has(repo.repoId) || search.trim() !== ''
  }))
  if (library.length > 0) {
    groups.push({
      id: LIBRARY_GROUP,
      label: 'Bibliothèque',
      items: libraryVisible.flatMap(({ repo, skills, open }) => [
        `${REPO_PREFIX}${repo.repoId}`,
        ...(open ? skills.map((skill) => `${LIB_PREFIX}${skill.candidateId}`) : [])
      ])
    })
  }
  const layout = layoutTree(groups)
  const nodes: TreeNode[] = [
    { id: 'trunk', type: 'trunk', position: layout.trunk, data: { count: visible.length }, selectable: false }
  ]
  const edges: Edge[] = []
  for (const group of groups) {
    const count =
      group.id === LIBRARY_GROUP
        ? library.reduce((total, repo) => total + repo.skills.length, 0)
        : visible.filter((skill) => skill.family === group.id).length
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
  const repos = new Map(libraryVisible.map((entry) => [`${REPO_PREFIX}${entry.repo.repoId}`, entry]))
  const available = new Map<string, LibrarySkillView>(
    libraryVisible.flatMap(({ skills }) => skills.map((skill) => [`${LIB_PREFIX}${skill.candidateId}`, skill] as const))
  )
  for (const [id, position] of layout.items) {
    const repo = repos.get(id)
    if (repo !== undefined) {
      const label = repoLabel(repo.repo.repo)
      nodes.push({
        id,
        type: 'repo',
        position,
        data: { label, count: repo.repo.skills.length, open: repo.open, selected: id === selectedId },
        ariaLabel: `Dépôt ${label} de la bibliothèque, ${repo.repo.skills.length} skills`
      })
      continue
    }
    const offered = available.get(id)
    if (offered !== undefined) {
      nodes.push({
        id,
        type: 'available',
        position,
        data: { skill: offered, selected: id === selectedId },
        ariaLabel: `${offered.name}, skill disponible de la bibliothèque, verdict ${VERDICTS[offered.verdict].label}`
      })
      continue
    }
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
    if (id.startsWith(GHOST_PREFIX)) {
      const draft = ghosts.find((candidate) => `${GHOST_PREFIX}${candidate.id}` === id)
      if (draft !== undefined) {
        nodes.push({
          id,
          type: 'ghost',
          position,
          data: { name: draft.name, description: draft.description, selected: id === selectedId },
          ariaLabel: `${draft.name}, brouillon de nouveau skill à installer`
        })
      }
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
  const drafts = useQuery({
    queryKey: ['skillDrafts', '*'],
    queryFn: () => call<SkillDraftView[]>('skills:drafts', {})
  })
  const ghosts = useMemo(() => (drafts.data ?? []).filter((draft) => draft.isNew), [drafts.data])
  const libraryQuery = useQuery({
    queryKey: ['skillLibrary'],
    queryFn: () => call<LibraryRepoView[]>('skills:library', {})
  })
  const library = useMemo(() => libraryQuery.data ?? [], [libraryQuery.data])
  const [showLibrary, setShowLibrary] = useState(true)
  const [openRepos, setOpenRepos] = useState<ReadonlySet<string>>(new Set())
  /** Import en cours : `''` pour un nouveau dépôt, l'adresse d'un dépôt à mettre à jour. */
  const [importUrl, setImportUrl] = useState<string | null>(null)
  const [families, setFamilies] = useState<ReadonlySet<SkillFamily>>(new Set(SKILL_FAMILIES))
  const [search, setSearch] = useState('')
  const [pluginsOpen, setPluginsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const view = query.data

  const selectedRepo = library.find((repo) => `${REPO_PREFIX}${repo.repoId}` === selectedId)
  const inLibrary = useCallback(
    (id: string): boolean =>
      library.some(
        (repo) =>
          `${REPO_PREFIX}${repo.repoId}` === id ||
          repo.skills.some((skill) => `${LIB_PREFIX}${skill.candidateId}` === id)
      ),
    [library]
  )

  // Un skill disparu (dossier supprimé, dépôt retiré ou mis à jour) referme sa fiche.
  useEffect(() => {
    if (selectedId === null || selectedId.startsWith(GHOST_PREFIX)) return
    if (selectedId.startsWith(REPO_PREFIX) || selectedId.startsWith(LIB_PREFIX)) {
      if (libraryQuery.data !== undefined && !inLibrary(selectedId)) setSelectedId(null)
    } else if (view !== undefined && !view.skills.some((skill) => skill.id === selectedId)) {
      setSelectedId(null)
    }
  }, [view, selectedId, libraryQuery.data, inLibrary])

  const toggleRepo = (repoId: string, open?: boolean): void =>
    setOpenRepos((current) => {
      const next = new Set(current)
      if (open ?? !next.has(repoId)) next.add(repoId)
      else next.delete(repoId)
      return next
    })

  const tree = useMemo(
    () =>
      view === undefined
        ? { nodes: [], edges: [] }
        : buildTree({
            view,
            ghosts,
            library: showLibrary ? library : [],
            families,
            search,
            pluginsOpen,
            openRepos,
            selectedId,
            onToggleCluster: () => setPluginsOpen(true)
          }),
    [view, ghosts, library, showLibrary, families, search, pluginsOpen, openRepos, selectedId]
  )
  const selectable = (id: string): boolean =>
    id.startsWith(GHOST_PREFIX) || inLibrary(id) || (view?.skills.some((skill) => skill.id === id) ?? false)
  const select = (id: string): void => {
    setSelectedId(id)
    if (id.startsWith(REPO_PREFIX)) toggleRepo(id.slice(REPO_PREFIX.length), true)
  }
  const librarySize = library.reduce((total, repo) => total + repo.skills.length, 0)

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
            {library.length === 0 ? null : (
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={showLibrary} onChange={() => setShowLibrary(!showLibrary)} />
                <span aria-hidden="true">{LIBRARY_ICON}</span> Bibliothèque ({librarySize})
              </label>
            )}
          </fieldset>
          {pluginsOpen ? (
            <button type="button" onClick={() => setPluginsOpen(false)} className="h-8 text-content-muted underline">
              Replier les plugins
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setImportUrl('')}
            className="ml-auto h-8 rounded-md border border-accent px-3 text-accent hover:bg-surface-raised"
          >
            Importer depuis GitHub…
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          {query.isError ? (
            <p role="alert" className="p-8 text-center text-sm">
              {query.error instanceof IpcFailure ? query.error.message : 'Les skills n’ont pas pu être lus.'}
            </p>
          ) : view === undefined ? (
            <p className="p-8 text-center text-sm text-content-muted">Lecture des skills…</p>
          ) : view.skills.length === 0 && library.length === 0 ? (
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
                if (node.type !== 'trunk' && node.type !== 'branch' && node.type !== 'cluster') select(node.id)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const id = (event.target as HTMLElement).closest('[data-id]')?.getAttribute('data-id')
                if (id !== null && id !== undefined && selectable(id)) select(id)
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
        {selectedId !== null && selectedId.startsWith(GHOST_PREFIX) ? (
          <div className="h-full overflow-auto">
            <DraftPanel
              key={selectedId}
              draftId={selectedId.slice(GHOST_PREFIX.length)}
              onDone={(skillId) => setSelectedId(skillId)}
            />
          </div>
        ) : selectedRepo !== undefined ? (
          <LibraryRepoPanel
            key={selectedRepo.repoId}
            repo={selectedRepo}
            open={openRepos.has(selectedRepo.repoId)}
            onToggle={() => toggleRepo(selectedRepo.repoId)}
            onUpdate={() => setImportUrl(selectedRepo.repo)}
            onClose={() => setSelectedId(null)}
          />
        ) : selectedId !== null && selectedId.startsWith(LIB_PREFIX) ? (
          <LibrarySkillPanel
            key={selectedId}
            candidateId={selectedId.slice(LIB_PREFIX.length)}
            onDraft={(draftId) => setSelectedId(`${GHOST_PREFIX}${draftId}`)}
            onClose={() => setSelectedId(null)}
          />
        ) : selectedId !== null && view !== undefined ? (
          <SkillPanel
            key={selectedId}
            skillId={selectedId}
            view={view}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          // Sans sélection : la conversation « Skills » générale (créer, combiner, faire le tri).
          <SkillConversation onClose={() => undefined} />
        )}
      </aside>
      {importUrl === null ? null : (
        <ImportDialog
          {...(importUrl === '' ? {} : { repoUrl: importUrl })}
          onDone={(repoId) => {
            setShowLibrary(true)
            toggleRepo(repoId, true)
            setSelectedId(`${REPO_PREFIX}${repoId}`)
          }}
          onClose={() => setImportUrl(null)}
        />
      )}
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
