import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import type {
  LibraryRepoView,
  LibrarySkillView,
  SkillAnalyzeProgressEvent,
  SkillCardsView,
  SkillDraftView,
  SkillsView,
  SkillUsageView,
  SkillView
} from '@shared/ipc/skills'
import { LINK_KIND_LABELS } from '@shared/skills/card'
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
  /** Fiches (US2) : dès qu'une existe, les skills personnels et de projet se rangent par domaine. */
  readonly cards?: SkillCardsView | undefined
  readonly usage?: Readonly<Record<string, SkillUsageView>> | undefined
}

/** Branche des skills sans fiche (et des brouillons de nouveaux skills) quand l'arbre est rangé par domaine. */
const UNSORTED_GROUP = 'domain:_'

/** Nœuds et liens de l'arbre (une branche par famille, plus la Bibliothèque), à partir de la toile filtrée. */
function buildTree(input: TreeInput): { readonly nodes: TreeNode[]; readonly edges: Edge[] } {
  const { view, ghosts, library, families, search, pluginsOpen, openRepos, selectedId, onToggleCluster } = input
  const { cards, usage } = input
  const visible = view.skills.filter((skill) => families.has(skill.family) && matches(skill, search))
  const collapsed = !pluginsOpen && search.trim() === ''
  const starsOf = (skill: SkillView): number => cards?.cards[skill.id]?.stars ?? 0
  // Note décroissante, puis nom.
  const ordered = (skills: readonly SkillView[]): string[] =>
    [...skills].sort((a, b) => starsOf(b) - starsOf(a) || (a.name < b.name ? -1 : 1)).map((skill) => skill.id)
  const byDomain = cards !== undefined && Object.keys(cards.cards).length > 0
  const familyGroup = (family: SkillFamily): TreeGroup => {
    const skills = visible.filter((skill) => skill.family === family)
    const folded = family === 'plugin' && collapsed && skills.length > 0
    const drafts = ghosts.filter((draft) => draft.family === family).map((draft) => `${GHOST_PREFIX}${draft.id}`)
    return {
      id: family,
      label: FAMILY_LABELS[family],
      items: [...drafts, ...(folded ? [CLUSTER_ID] : ordered(skills))]
    }
  }
  const groups: TreeGroup[] = []
  if (!byDomain) {
    groups.push(...SKILL_FAMILIES.filter((family) => families.has(family)).map(familyGroup))
  } else {
    // Rangement par domaine (lot B) pour les skills personnels et de projet ; les plugins gardent leur grappe.
    const own = visible.filter((skill) => skill.family !== 'plugin')
    const known = new Set(cards.domains.map((domain) => domain.id))
    for (const domain of cards.domains) {
      const items = ordered(own.filter((skill) => cards.cards[skill.id]?.domainId === domain.id))
      if (items.length > 0) {
        groups.push({ id: `domain:${domain.id}`, label: `${domain.label}${domain.pending ? ' (proposé)' : ''}`, items })
      }
    }
    const unsorted = own.filter((skill) => !known.has(cards.cards[skill.id]?.domainId ?? ''))
    const drafts = ghosts.filter((draft) => families.has(draft.family)).map((draft) => `${GHOST_PREFIX}${draft.id}`)
    if (unsorted.length + drafts.length > 0) {
      groups.push({ id: UNSORTED_GROUP, label: 'À analyser', items: [...drafts, ...ordered(unsorted)] })
    }
    if (families.has('plugin')) groups.push(familyGroup('plugin'))
  }
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
        : group.id.startsWith('domain:')
          ? group.items.length
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
      data: {
        skill,
        selected: id === selectedId,
        ...(cards?.cards[id] === undefined ? {} : { stars: cards.cards[id].stars }),
        ...(usage?.[id] === undefined ? {} : { calls: usage[id].calls30d })
      },
      ariaLabel: `${skill.name}, skill ${FAMILY_LABELS[skill.family].toLowerCase()}${
        cards?.cards[id] === undefined ? '' : `, ${cards.cards[id].stars} étoiles sur 5`
      }${skill.hasScripts ? ', contient des scripts' : ''}${skill.damaged ? ', abîmé' : ''}`
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
  // Liens de sens (US2) : en pointillés, la sorte dans le libellé accessible.
  for (const link of cards?.links ?? []) {
    if (!layout.items.has(link.from) || !layout.items.has(link.to)) continue
    edges.push({
      id: `sens:${link.id}`,
      source: link.from,
      target: link.to,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 1.5, strokeDasharray: '6 4' },
      ariaLabel: `${link.from.split(':').at(-1) ?? ''} ${LINK_KIND_LABELS[link.kind]} ${link.to.split(':').at(-1) ?? ''}`
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
  const client = useQueryClient()
  const cardsQuery = useQuery({ queryKey: ['skillCards'], queryFn: () => call<SkillCardsView>('skills:cards', {}) })
  const usageQuery = useQuery({
    queryKey: ['skillUsage'],
    queryFn: () => call<Record<string, SkillUsageView>>('skills:usage', {})
  })
  const [analysis, setAnalysis] = useState<SkillAnalyzeProgressEvent | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  useEffect(
    () =>
      window.api.on('skills:analyzeProgress', (payload) => {
        const event = payload as SkillAnalyzeProgressEvent
        if (event.done < event.total) {
          setAnalysis(event)
          return
        }
        setAnalysis(null)
        void client.invalidateQueries({ queryKey: ['skillCards'] })
        if (event.failed > 0) {
          setAnalyzeError(
            `${event.failed} fiche${event.failed > 1 ? 's' : ''} sur ${event.total} n’ont pas pu être rédigées.`
          )
        }
      }),
    [client]
  )
  const analyze = async (): Promise<void> => {
    setAnalyzeError('')
    try {
      const { analysisId, total } = await call<{ analysisId: string; total: number }>('skills:analyze', {})
      if (total === 0) setAnalyzeError('Toutes les fiches sont à jour.')
      else setAnalysis({ analysisId, done: 0, total, failed: 0 })
    } catch (failure) {
      setAnalyzeError(failure instanceof IpcFailure ? failure.message : 'L’analyse n’a pas pu démarrer.')
    }
  }
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
            onToggleCluster: () => setPluginsOpen(true),
            cards: cardsQuery.data,
            usage: usageQuery.data
          }),
    [
      view,
      ghosts,
      library,
      showLibrary,
      families,
      search,
      pluginsOpen,
      openRepos,
      selectedId,
      cardsQuery.data,
      usageQuery.data
    ]
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
            disabled={analysis !== null}
            onClick={() => void analyze()}
            className="ml-auto h-8 rounded-md border border-content-muted/40 px-3 hover:bg-surface-raised disabled:opacity-60"
          >
            {analysis === null ? 'Analyser les skills' : `Analyse… ${analysis.done} / ${analysis.total}`}
          </button>
          <button
            type="button"
            onClick={() => setImportUrl('')}
            className="h-8 rounded-md border border-accent px-3 text-accent hover:bg-surface-raised"
          >
            Importer depuis GitHub…
          </button>
        </div>
        {analyzeError === '' ? null : (
          <p role="status" className="border-b border-content-muted/20 px-4 py-1 text-xs">
            {analyzeError}
          </p>
        )}
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
