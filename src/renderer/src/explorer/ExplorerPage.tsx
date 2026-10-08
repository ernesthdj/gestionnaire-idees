import {
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeChange,
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CodeCategory, CodeLang, ExplorerLinkView, ExplorerPlaceView, ExplorerView } from '@shared/ipc/reprise'
import { colorSchemeOf } from '@shared/ipc/app'
import { CODE_CATEGORIES } from '@shared/ipc/reprise'
import { useEffectiveSettings } from '../app/useAppSettings'
import { Button } from '../components/atoms/Button'
import { call } from '../lib/ipc'
import { ConfidentialityBadge } from '../reprise/ConfidentialityBadge'
import { ExplorerList } from './ExplorerList'
import {
  ExplorerNodeActionsContext,
  FolderNode,
  ModuleNode,
  type FolderNodeType,
  type ModuleNodeType
} from './ExplorerNodes'
import { FilePanel, type OpenFile } from './FilePanel'
import { GuidePanel } from './GuidePanel'
import { CATEGORY_LABELS, KIND_LABELS, LEVEL_NAMES, PROVENANCE_LABELS } from './labels'
import { NodePanel } from './NodePanel'
import { semanticZoom } from './semanticZoom'
import { useExplorer } from './useExplorer'

const NODE_TYPES = { module: ModuleNode, folder: FolderNode }
const ARIA_LABELS = {
  'node.a11yDescription.default': 'Entrée pour voir l’élément ; double-clic pour l’ouvrir.',
  'node.a11yDescription.keyboardDisabled': 'Entrée pour voir l’élément.',
  'edge.a11yDescription.default': 'Appels entre deux éléments.',
  'controls.ariaLabel': 'Zoom',
  'controls.zoomIn.ariaLabel': 'Zoomer',
  'controls.zoomOut.ariaLabel': 'Dézoomer',
  'controls.fitView.ariaLabel': 'Tout afficher',
  'controls.interactive.ariaLabel': 'Verrouiller la carte'
}

type CodeNodeType = ModuleNodeType | FolderNodeType

function toFlow(view: ExplorerView, selected: string | null): { nodes: CodeNodeType[]; edges: Edge[] } {
  return {
    nodes: view.nodes.map((node) => ({
      id: node.key,
      type: node.kind === 'module' ? ('module' as const) : ('folder' as const),
      position: { x: node.x ?? 0, y: node.y ?? 0 },
      data: { ...node, selected: node.key === selected },
      ariaLabel: `${KIND_LABELS[node.kind].text} ${node.title}, ${CATEGORY_LABELS[node.category].text}${
        node.childCount === 0 ? '' : `, ${node.childCount} éléments à l’intérieur`
      }${node.files.length === 0 ? '' : `, ${node.files.length} fichiers`}`
    })) as CodeNodeType[],
    edges: view.edges.map((edge) => ({
      id: `${edge.from}→${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edge.count > 1 ? String(edge.count) : undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      ariaLabel: `${edge.count} appel${edge.count > 1 ? 's' : ''}, ${PROVENANCE_LABELS[edge.provenance].text}`,
      style: {
        strokeWidth: 1 + Math.min(5, Math.log2(edge.count + 1)),
        strokeDasharray: PROVENANCE_LABELS[edge.provenance].dash
      }
    }))
  }
}

function ExplorerMap({
  genesisId,
  view,
  parentKey,
  selected,
  centerKey,
  onSelect,
  onOpen,
  onUp,
  onCentered
}: {
  readonly genesisId: string
  readonly view: ExplorerView
  readonly parentKey: string
  readonly selected: string | null
  /** Élément à cadrer (lien cité par le guide), une seule fois. */
  readonly centerKey: string | null
  readonly onSelect: (key: string | null) => void
  readonly onOpen: (key: string) => void
  readonly onUp: () => void
  readonly onCentered: () => void
}): React.JSX.Element {
  const settings = useEffectiveSettings()
  const flow = useReactFlow()
  const surface = useRef<HTMLDivElement>(null)
  const built = useMemo(() => toFlow(view, selected), [view, selected])
  const [nodes, setNodes] = useState<CodeNodeType[]>(built.nodes)
  useEffect(() => setNodes(built.nodes), [built.nodes])
  useEffect(() => {
    if (centerKey === null || !built.nodes.some((node) => node.id === centerKey)) return
    const frame = requestAnimationFrame(() => {
      void flow.fitView({ nodes: [{ id: centerKey }], duration: 300, maxZoom: 1.2 })
      onCentered()
    })
    return () => cancelAnimationFrame(frame)
  }, [centerKey, built.nodes, flow, onCentered])
  // Zoom d'arrivée du niveau : relevé au début du premier geste de mentalyas (la carte vient d'être cadrée).
  const arrival = useRef<number | null>(null)
  useEffect(() => {
    arrival.current = null
  }, [parentKey])

  // Zoom sémantique (spec 017 D10) : seuls les gestes de mentalyas comptent (`event` nul : recadrage automatique).
  const onMoveStart = (event: unknown, viewport: Viewport): void => {
    if (event !== null && arrival.current === null) arrival.current = viewport.zoom
  }
  const onMoveEnd = (event: unknown, viewport: Viewport): void => {
    if (event === null || arrival.current === null) return
    const action = semanticZoom(viewport.zoom, arrival.current, parentKey === '')
    if (action === 'up') {
      onUp()
      return
    }
    if (action !== 'open' || surface.current === null) return
    const box = surface.current.getBoundingClientRect()
    const centre = flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    const target = nodes
      .filter((node) => node.data.childCount > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.position.x - centre.x, a.position.y - centre.y) -
          Math.hypot(b.position.x - centre.x, b.position.y - centre.y)
      )[0]
    if (target !== undefined) onOpen(target.id)
  }

  return (
    <div ref={surface} className="h-full w-full">
      <ReactFlow<CodeNodeType>
        // Une carte par niveau : chaque niveau est cadré à son arrivée.
        key={parentKey}
        nodes={nodes}
        edges={built.edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={(changes: NodeChange<CodeNodeType>[]) =>
          setNodes((current) => applyNodeChanges<CodeNodeType>(changes, current))
        }
        onNodeDragStop={(_event, node) =>
          void call('explorer:savePosition', {
            genesisId,
            parentKey,
            nodeKey: node.id,
            x: node.position.x,
            y: node.position.y
          }).catch(() => undefined)
        }
        onNodeClick={(_event, node) => onSelect(node.id)}
        onNodeDoubleClick={(_event, node) => {
          if (node.data.childCount > 0) onOpen(node.id)
        }}
        onPaneClick={() => onSelect(null)}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        zoomOnDoubleClick={false}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        minZoom={0.2}
        maxZoom={2.5}
        ariaLabelConfig={ARIA_LABELS}
        colorMode={colorSchemeOf(settings.theme)}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

/**
 * Explorateur d'un projet repris (spec 017 US2, L4d E4) : carte des éléments du niveau ouvert (62 %) et panneau de
 * l'élément choisi (38 %) ; fil d'Ariane, indicateur de niveau, zoom sémantique, filtres, recherche, « isoler », vue
 * liste équivalente, état de l'analyse et badge de confidentialité.
 */
export function ExplorerPage({
  genesisId,
  onClose
}: {
  readonly genesisId: string
  readonly onClose: () => void
}): React.JSX.Element {
  const explorer = useExplorer(genesisId)
  const ids = { title: useId(), search: useId(), lang: useId() }
  const [list, setList] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    readonly (ExplorerPlaceView & { readonly key: string; readonly title: string; readonly where: string })[]
  >([])
  const view = explorer.view
  const project = explorer.project
  const [aside, setAside] = useState<'element' | 'code' | 'guide'>('element')
  const [centerKey, setCenterKey] = useState<string | null>(null)
  const [file, setFile] = useState<OpenFile | null>(null)
  const guideId = project?.guide.documentId ?? null
  // Un guide qui vient d'exister (rédigé après la première analyse) s'ouvre dans le panneau (spec 017 US4).
  const knownGuide = useRef<string | null>(null)
  useEffect(() => {
    if (knownGuide.current === null && guideId !== null) setAside('guide')
    knownGuide.current = guideId
  }, [guideId])
  const select = (key: string | null): void => {
    explorer.select(key)
    if (key !== null) setAside('element')
  }
  const clearCenter = useCallback(() => setCenterKey(null), [])
  // Fichier montré dans le volet (D16) ; `show` : passer sur l'onglet « Code » (pas depuis le guide).
  const openFile = (next: OpenFile, show = true): void => {
    setFile(next)
    if (show) setAside('code')
  }
  // Le fichier lu : la carte montre le nœud de son dossier, au bon niveau.
  const placeFile = (place: ExplorerPlaceView): void => {
    if (place.parentKey === explorer.parentKey) explorer.select(place.nodeKey)
    else explorer.open(place.parentKey, place.nodeKey)
  }
  const goTo = (place: ExplorerPlaceView & { readonly key: string }, show = true): void => {
    explorer.open(place.parentKey, place.nodeKey)
    setCenterKey(place.nodeKey)
    if (place.path !== null) openFile({ path: place.path, line: null, symbolId: place.symbolId }, show)
  }
  const linkGo = (link: ExplorerLinkView): void => {
    if (link.path !== null) {
      openFile({ path: link.path, line: null, symbolId: link.key.startsWith('s:') ? link.key.slice(2) : null })
    }
  }
  const nodeActions = {
    openFile: (path: string) => openFile({ path, line: null, symbolId: null }),
    open: (key: string) => explorer.open(key),
    openPath: file?.path ?? null
  }

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      call<{ readonly results: typeof results }>('explorer:search', { genesisId, query: trimmed })
        .then((found) => setResults(found.results))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [query, genesisId])

  const up = (): void => {
    const crumbs = view?.breadcrumb ?? []
    explorer.open(crumbs.at(-2)?.key ?? '')
  }
  const toggleCategory = (category: CodeCategory): void => {
    const categories = explorer.filters.categories.includes(category)
      ? explorer.filters.categories.filter((value) => value !== category)
      : [...explorer.filters.categories, category]
    explorer.setFilters({ ...explorer.filters, categories })
  }

  const analysis = project?.analysis
  const neverAnalyzed = analysis !== undefined && analysis.analyzedAt === null && analysis.state !== 'running'
  return (
    <section aria-labelledby={ids.title} className="flex h-full flex-col">
      <header className="flex flex-col gap-2 border-b border-content-muted/20 px-4 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onClose}>← Carte</Button>
          <h2 id={ids.title} className="text-base font-semibold">
            Explorateur · {project?.name ?? '…'}
          </h2>
          {project === undefined ? null : (
            <ConfidentialityBadge genesisId={genesisId} level={project.confidentiality} onChanged={() => undefined} />
          )}
          <div className="ml-auto flex items-center gap-2">
            {explorer.progress !== null ? (
              <>
                <p role="status" className="text-xs">
                  Analyse en cours…
                  {explorer.progress.total === 0
                    ? ''
                    : ` ${explorer.progress.done} / ${explorer.progress.total} fichiers`}
                </p>
                <Button onClick={explorer.cancelAnalysis}>Annuler</Button>
              </>
            ) : (
              <Button onClick={() => void explorer.analyze()} disabled={view?.folderMissing === true}>
                {neverAnalyzed ? 'Analyser' : 'Réanalyser'}
              </Button>
            )}
            <Button onClick={() => setList((current) => !current)} aria-pressed={list}>
              {list ? 'Vue carte' : 'Vue liste'}
            </Button>
          </div>
        </div>
        <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1 text-xs">
          {explorer.parentKey === '' ? null : (
            <button type="button" onClick={up} className="mr-2 rounded-md border border-content-muted/40 px-2 py-0.5">
              ↑ Niveau au-dessus
            </button>
          )}
          {(view?.breadcrumb ?? [{ key: '', title: 'Projet' }]).map((crumb, index, all) => (
            <span key={crumb.key} className="flex items-center gap-1">
              {index === 0 ? null : <span aria-hidden="true">›</span>}
              {index === all.length - 1 ? (
                <span aria-current="location" className="font-semibold">
                  {crumb.title}
                </span>
              ) : (
                <button type="button" className="underline" onClick={() => explorer.open(crumb.key)}>
                  {crumb.title}
                </button>
              )}
            </span>
          ))}
          <span className="ml-3 text-content-muted" aria-label={`Niveau ${view?.level ?? 1} sur ${LEVEL_NAMES.length}`}>
            Zoom{' '}
            {LEVEL_NAMES.map((name, index) => (
              <span key={name} className={index + 1 === view?.level ? 'font-semibold text-content' : ''}>
                {index === 0 ? '' : ' · '}
                {index + 1} {name}
              </span>
            ))}
          </span>
        </nav>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Catégories affichées</legend>
            {CODE_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={explorer.filters.categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                <span aria-hidden="true">{CATEGORY_LABELS[category].icon}</span> {CATEGORY_LABELS[category].text}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={explorer.filters.hideUncertain}
              onChange={() =>
                explorer.setFilters({ ...explorer.filters, hideUncertain: !explorer.filters.hideUncertain })
              }
            />
            Masquer les liens incertains
          </label>
          <label htmlFor={ids.lang} className="sr-only">
            Langage
          </label>
          <select
            id={ids.lang}
            value={explorer.filters.langs[0] ?? ''}
            onChange={(event) =>
              explorer.setFilters({
                ...explorer.filters,
                langs: event.target.value === '' ? [] : [event.target.value as CodeLang]
              })
            }
            className="h-7 rounded-md bg-surface-raised px-1"
          >
            <option value="">Tous les langages</option>
            <option value="ts">TypeScript</option>
            <option value="js">JavaScript</option>
            <option value="cs">C#</option>
            <option value="php">PHP</option>
          </select>
          {explorer.focusKey === null ? null : <Button onClick={() => explorer.isolate(null)}>Tout réafficher</Button>}
          <div className="relative ml-auto">
            <label htmlFor={ids.search} className="sr-only">
              Rechercher un élément
            </label>
            <input
              id={ids.search}
              type="search"
              value={query}
              maxLength={100}
              placeholder="Rechercher un fichier, une classe…"
              onChange={(event) => setQuery(event.target.value)}
              className="h-7 w-64 rounded-md bg-surface-raised px-2"
            />
            {results.length === 0 ? null : (
              <ul
                aria-label="Résultats de la recherche"
                className="absolute right-0 z-10 mt-1 max-h-72 w-96 overflow-y-auto rounded-md bg-surface p-1 shadow-lg"
              >
                {results.map((result) => (
                  <li key={result.key}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1 text-left hover:bg-surface-raised"
                      onClick={() => {
                        goTo(result)
                        setQuery('')
                      }}
                    >
                      <span className="font-semibold">{result.title}</span>{' '}
                      <span className="text-content-muted">{result.where}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {view === undefined ? null : (
          <p className="text-xs text-content-muted" aria-live="polite">
            {view.nodes.length} éléments
            {view.hidden.nodes === 0 ? '' : ` · ${view.hidden.nodes} masqués par les filtres`}
            {view.hidden.plumbingCalls === 0 ? '' : ` · ${view.hidden.plumbingCalls} appels de plomberie masqués`}
            {view.grouped.map((group) => ` · ${group.title} regroupés`).join('')}
          </p>
        )}
        {view?.folderMissing === true ? (
          <p role="alert" className="text-xs text-con">
            Le dossier du projet est introuvable (déplacé ou supprimé ?) : la dernière analyse reste lisible.
          </p>
        ) : null}
        {neverAnalyzed ? (
          <p role="status" className="text-xs">
            Ce projet n’a pas encore été analysé : lance « Analyser ».
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 basis-[62%]">
          {explorer.problem !== null ? (
            <p role="alert" className="p-4 text-sm text-con">
              {explorer.problem}
            </p>
          ) : view === undefined ? (
            <p className="p-4 text-sm text-content-muted">Chargement…</p>
          ) : list ? (
            <ExplorerList
              view={view}
              selected={explorer.selected}
              openPath={file?.path ?? null}
              onSelect={select}
              onOpen={(key) => explorer.open(key)}
              onOpenFile={nodeActions.openFile}
            />
          ) : (
            <ExplorerNodeActionsContext.Provider value={nodeActions}>
              <ReactFlowProvider>
                <ExplorerMap
                  genesisId={genesisId}
                  view={view}
                  parentKey={explorer.parentKey}
                  selected={explorer.selected}
                  centerKey={centerKey}
                  onSelect={select}
                  onOpen={(key) => explorer.open(key)}
                  onUp={up}
                  onCentered={clearCenter}
                />
              </ReactFlowProvider>
            </ExplorerNodeActionsContext.Provider>
          )}
        </div>
        <aside
          aria-label={aside === 'guide' ? 'Guide de reprise' : aside === 'code' ? 'Code du fichier' : 'Élément choisi'}
          className={`flex min-w-0 flex-col border-l border-content-muted/20 ${
            aside === 'code' ? 'basis-[50%]' : 'basis-[38%]'
          }`}
        >
          <div
            role="tablist"
            aria-label="Panneau de droite"
            className="flex gap-1 border-b border-content-muted/20 px-4 py-2"
          >
            {(['element', 'code', 'guide'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={aside === value}
                disabled={value === 'code' && file === null}
                onClick={() => setAside(value)}
                className={`max-w-[50%] truncate rounded-md px-3 py-1 text-xs disabled:opacity-40 ${
                  aside === value ? 'bg-surface-raised font-semibold' : 'text-content-muted'
                }`}
              >
                {value === 'element'
                  ? 'Élément'
                  : value === 'guide'
                    ? 'Guide de reprise'
                    : file === null
                      ? 'Code'
                      : `Code · ${file.path.split('/').at(-1) ?? ''}`}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {aside === 'guide' && project !== undefined ? (
              <GuidePanel
                genesisId={genesisId}
                guide={project.guide}
                analyzed={project.analysis.analyzedAt !== null}
                onLocate={(place) => goTo(place, false)}
              />
            ) : aside === 'code' && file !== null ? (
              <FilePanel genesisId={genesisId} file={file} onOpenFile={openFile} onPlaced={placeFile} />
            ) : explorer.selected === null ? (
              <div className="flex flex-col gap-2 p-4 text-sm text-content-muted">
                <p>Choisis un module ou un dossier pour voir ce qu’il fait, qui l’appelle et ce qu’il appelle.</p>
                <p>
                  Double-clic (ou zoom très près) sur un module pour voir ses dossiers ; dans un dossier, l’onglet «
                  Fichiers » ouvre le code ici.
                </p>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex gap-2 border-b border-content-muted/20 px-4 py-2">
                  <Button onClick={() => explorer.isolate(explorer.selected)}>Isoler</Button>
                </div>
                <div className="min-h-0 flex-1">
                  <NodePanel
                    genesisId={genesisId}
                    nodeKey={explorer.selected}
                    onGo={linkGo}
                    onOpen={(parentKey, key) => explorer.open(parentKey, key)}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <details className="border-t border-content-muted/20 px-4 py-1 text-xs">
        <summary className="cursor-pointer">Légende</summary>
        <p className="py-1">
          {Object.values(PROVENANCE_LABELS)
            .filter((entry, index, all) => all.findIndex((other) => other.text === entry.text) === index)
            .map((entry) => `${entry.mark} ${entry.text}`)
            .join(' · ')}{' '}
          · épaisseur = nombre d’appels ·{' '}
          {CODE_CATEGORIES.map(
            (category) => `${CATEGORY_LABELS[category].icon} ${CATEGORY_LABELS[category].text}`
          ).join(' · ')}
        </p>
      </details>
    </section>
  )
}
