import {
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type Edge,
  type NodeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './boxes.css'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { colorSchemeOf } from '@shared/ipc/app'
import type { ExplorerMapView, LinkProvenance, MapCallSentence, MapFileView, MapModuleView } from '@shared/ipc/reprise'
import { weakestProvenance } from '@shared/ipc/reprise'
import { useEffectiveSettings } from '../../app/useAppSettings'
import { MarksKindContext, ReplayMarksContext } from '../ExplorerNodes'
import { LAYER_LABELS, PROVENANCE_LABELS, sentenceText } from '../labels'
import { boxLayout, isBig, type Rect, type ShownBoxes } from './boxLayout'
import {
  FileBox,
  FrameBox,
  ModuleBox,
  StubBox,
  type FileBoxNode,
  type FrameBoxNode,
  type ModuleBoxNode,
  type StubBoxNode
} from './BoxNodes'
import { insideLayout, neighboursOf } from './insideLayout'
import { ease, fadeIn, fitFrame, lerp, lerpRect, MORPH_MS, onScreen, viewportOnto, type Viewport } from './sceneMath'

const NODE_TYPES = { module: ModuleBox, file: FileBox, frame: FrameBox, stub: StubBox }
const ARIA_LABELS = {
  'node.a11yDescription.default':
    'Entrée pour ouvrir ou fermer le module, ou ouvrir le code du fichier ; double-clic pour entrer dans le module.',
  'node.a11yDescription.keyboardDisabled': 'Entrée pour ouvrir ou fermer le module, ou ouvrir le code du fichier.',
  'edge.a11yDescription.default': 'Appels entre deux éléments.',
  'controls.ariaLabel': 'Zoom',
  'controls.zoomIn.ariaLabel': 'Zoomer',
  'controls.zoomOut.ariaLabel': 'Dézoomer',
  'controls.fitView.ariaLabel': 'Tout afficher',
  'controls.interactive.ariaLabel': 'Verrouiller la carte'
}
/** Délai d'un clic simple sur un module : un double-clic (entrer) ne doit pas l'ouvrir puis le refermer. */
const CLICK_DELAY_MS = 220
const STUB = 'stub:'

type BoxNode = ModuleBoxNode | FileBoxNode | FrameBoxNode | StubBoxNode

/** Ce que dit une marque de la spec 021 (rediffusion, nouveautés) au lecteur d'écran ; vide sans marques. */
function marksText(
  kind: string,
  byKey: ReadonlyMap<string, { readonly author: { readonly name: string } }> | null,
  key: string
): string {
  if (byKey === null) return ''
  const mark = byKey.get(key)
  if (kind === 'updates') return mark === undefined ? '' : `, nouveauté de ${mark.author.name}`
  return mark === undefined ? ', jamais touché jusqu’ici' : `, rediffusion : ${mark.author.name}`
}

interface Link {
  readonly from: string
  readonly to: string
  count: number
  provenance: LinkProvenance
  readonly sentences: MapCallSentence[]
  readonly internal: boolean
}

/** Regroupe les appels par paire d'extrémités montrées (`end` : `null` si l'extrémité n'est pas à l'écran). */
function linksOf(
  map: ExplorerMapView,
  end: (fileKey: string) => string | null,
  moduleOf: ReadonlyMap<string, string>
): Link[] {
  const links = new Map<string, Link>()
  for (const call of map.calls) {
    const from = end(call.from)
    const to = end(call.to)
    if (from === null || to === null || from === to) continue
    const key = `${from}→${to}`
    const link = links.get(key) ?? {
      from,
      to,
      count: 0,
      provenance: call.provenance,
      sentences: [],
      internal: moduleOf.get(call.from) === moduleOf.get(call.to)
    }
    link.count += call.count
    link.provenance = weakestProvenance(link.provenance, call.provenance)
    for (const sentence of call.sentences) if (link.sentences.length < 6) link.sentences.push(sentence)
    links.set(key, link)
  }
  return [...links.values()]
}

function edgeOf(link: Link): Edge {
  const text = link.sentences.map(sentenceText)
  return {
    id: `${link.from}→${link.to}`,
    source: link.from,
    target: link.to,
    markerEnd: { type: MarkerType.ArrowClosed },
    ariaLabel: text.join(' ; ') || `${link.count} appel${link.count > 1 ? 's' : ''}`,
    data: { text: text.join(' · ') },
    style: {
      strokeWidth: 1.4 + Math.min(4, Math.log2(link.count + 1)),
      strokeDasharray: PROVENANCE_LABELS[link.provenance].dash,
      stroke:
        link.provenance === 'uncertain' ? 'var(--color-action)' : link.internal ? 'var(--color-accent)' : undefined
    }
  }
}

/** Une scène : ses nœuds, ses traits, et la place (coordonnées de la carte) de chaque nœud. */
interface Scene {
  readonly nodes: BoxNode[]
  readonly edges: Edge[]
  readonly rects: ReadonlyMap<string, Rect>
}

/** Nœud de la vraie scène (jamais celui de la copie figée, qui porte le même identifiant). */
const nodeElement = (root: HTMLElement, id: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(
    `:scope > .react-flow:not(.scene-ghost) .react-flow__node[data-id="${CSS.escape(id)}"]`
  )

/** Rectangle d'un élément, en pixels de la carte visible. */
function rectIn(root: HTMLElement, element: Element): Rect {
  const a = root.getBoundingClientRect()
  const b = element.getBoundingClientRect()
  return { x: b.left - a.left, y: b.top - a.top, width: b.width, height: b.height }
}

const transformOf = (view: Viewport): string => `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`
const nextFrame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()))

/**
 * Carte de l'explorateur en boîtes (spec 031 lots 2-3). Carte d'ensemble : les modules de gauche à droite dans le sens
 * des appels ; un clic ouvre une boîte sur place, un clic dans le vide les referme ; le survol d'un trait dit l'appel en
 * mots. Double-clic : entrer dans le module (seulement son intérieur, ses fichiers et leurs appels, des amorces vers
 * les voisins) ; une amorce mène au voisin ; Échap ressort. Les deux scènes cadrent leur nœud dans le même rectangle à
 * chaque image : le nœud et ses fichiers grandissent ensemble, à la même échelle.
 */
export function BoxMap({
  map,
  shown,
  open,
  focus,
  selected,
  onModule,
  onFile,
  onSelect,
  onEnter,
  onLeave,
  onCloseAll,
  onCaption
}: {
  readonly map: ExplorerMapView
  readonly shown: ShownBoxes
  readonly open: ReadonlySet<string>
  /** Module dans lequel on est entré ; `null` : la carte d'ensemble. */
  readonly focus: string | null
  readonly selected: string | null
  readonly onModule: (key: string) => void
  readonly onFile: (file: MapFileView) => void
  readonly onSelect: (key: string) => void
  readonly onEnter: (key: string) => void
  readonly onLeave: () => void
  readonly onCloseAll: () => void
  /** Phrase de l'élément ou du trait survolé ; `null` : rien. */
  readonly onCaption: (text: string | null) => void
}): React.JSX.Element {
  const settings = useEffectiveSettings()
  const flow = useReactFlow<BoxNode>()
  const byKey = useContext(ReplayMarksContext)
  const markKind = useContext(MarksKindContext)
  const root = useRef<HTMLDivElement>(null)
  // Scène dessinée (elle rattrape `focus` à la fin d'une transition).
  const [scene, setScene] = useState<string | null>(focus)
  const moduleOf = useMemo(() => {
    const owner = new Map<string, string>()
    for (const [key, files] of shown.filesOf) for (const file of files) owner.set(file.key, key)
    return owner
  }, [shown])
  const modulesByKey = useMemo(() => new Map(shown.modules.map((module) => [module.key, module] as const)), [shown])

  const built = useMemo((): Scene => {
    const rects = new Map<string, Rect>()
    const nodes: BoxNode[] = []
    const inside = scene === null ? undefined : modulesByKey.get(scene)
    if (inside === undefined) {
      const layout = boxLayout(shown, open)
      for (const module of shown.modules) {
        const rect = layout.modules.get(module.key)
        if (rect === undefined) continue
        rects.set(module.key, rect)
        const files = shown.filesOf.get(module.key) ?? []
        const isOpen = open.has(module.key)
        nodes.push({
          id: module.key,
          type: 'module',
          position: { x: rect.x, y: rect.y },
          style: { width: rect.width, height: rect.height },
          data: { module, open: isOpen, big: isBig(files), files, selected: selected === module.key },
          ariaLabel: `module ${module.title}, ${LAYER_LABELS[module.layer].text}${module.role === null ? '' : `. ${module.role}`}, ${
            module.files
          } fichiers, ${isOpen ? 'ouvert' : 'fermé'}${marksText(markKind, byKey, module.key)}`
        })
        if (!isOpen || isBig(files)) continue
        for (const file of files) {
          const place = layout.files.get(file.key)
          if (place === undefined) continue
          nodes.push({
            id: file.key,
            type: 'file',
            parentId: module.key,
            position: { x: place.x, y: place.y },
            style: { width: place.width, height: place.height },
            data: { file, selected: selected === file.key },
            ariaLabel: `fichier ${file.title}${file.role === null ? '' : `. ${file.role}`}${marksText(markKind, byKey, file.key)}`
          })
        }
      }
      const inBoxes = new Set(nodes.filter((node) => node.type === 'file').map((node) => node.id))
      const end = (fileKey: string): string | null => (inBoxes.has(fileKey) ? fileKey : (moduleOf.get(fileKey) ?? null))
      return { nodes, edges: linksOf(map, end, moduleOf).map(edgeOf), rects }
    }
    // Dedans : le cadre à l'origine, ses fichiers, ses amorces ; rien d'autre de la carte.
    const files = shown.filesOf.get(inside.key) ?? []
    const neighbours = neighboursOf(inside.key, map.calls, moduleOf)
    const layout = insideLayout(files, neighbours)
    rects.set(inside.key, { x: 0, y: 0, width: layout.width, height: layout.height })
    nodes.push({
      id: inside.key,
      type: 'frame',
      position: { x: 0, y: 0 },
      style: { width: layout.width, height: layout.height },
      zIndex: -1,
      draggable: false,
      data: { module: inside, selected: selected === inside.key },
      ariaLabel: `intérieur du module ${inside.title}, ${LAYER_LABELS[inside.layer].text}${inside.role === null ? '' : `. ${inside.role}`}${marksText(markKind, byKey, inside.key)}`
    })
    for (const file of files) {
      const place = layout.files.get(file.key)
      if (place === undefined) continue
      rects.set(file.key, place)
      nodes.push({
        id: file.key,
        type: 'file',
        position: { x: place.x, y: place.y },
        style: { width: place.width, height: place.height },
        data: { file, selected: selected === file.key, inside: true },
        ariaLabel: `fichier ${file.title}${file.role === null ? '' : `. ${file.role}`}${
          file.functions.length === 0 ? '' : `, fonctions ${file.functions.slice(0, 4).join(', ')}`
        }${marksText(markKind, byKey, file.key)}`
      })
    }
    for (const stub of layout.stubs) {
      const neighbour = modulesByKey.get(stub.moduleKey)
      if (neighbour === undefined) continue
      rects.set(`${STUB}${stub.moduleKey}`, stub.rect)
      nodes.push({
        id: `${STUB}${stub.moduleKey}`,
        type: 'stub',
        position: { x: stub.rect.x, y: stub.rect.y },
        style: { width: stub.rect.width, height: stub.rect.height },
        draggable: false,
        data: { module: neighbour, side: stub.side },
        ariaLabel: `${stub.side === 'in' ? 'appelé par' : 'appelle'} le module ${neighbour.title} : entrer dedans`
      })
    }
    const end = (fileKey: string): string | null => {
      const owner = moduleOf.get(fileKey)
      if (owner === inside.key) return fileKey
      return owner === undefined ? null : `${STUB}${owner}`
    }
    const links = linksOf(map, end, moduleOf).filter(
      (link) => !(link.from.startsWith(STUB) && link.to.startsWith(STUB))
    )
    return { nodes, edges: links.map(edgeOf), rects }
  }, [map, shown, open, scene, selected, byKey, markKind, moduleOf, modulesByKey])

  // Les boîtes restent déplaçables (spec 031 lot 5 : positions gardées) ; une nouvelle mise en page les replace.
  const [nodes, setNodes] = useState<BoxNode[]>(built.nodes)
  useEffect(() => setNodes(built.nodes), [built.nodes])
  const sceneRef = useRef(built)
  sceneRef.current = built

  // ── Transitions ────────────────────────────────────────────────────────────────────────────────────────────────
  const mapView = useRef<Viewport | null>(null)
  const running = useRef(false)
  const focusRef = useRef(focus)
  focusRef.current = focus

  /** Attend que la nouvelle scène ait dessiné le nœud `id` (quelques images au plus). */
  const rendered = useCallback(async (id: string): Promise<HTMLElement | null> => {
    for (let frame = 0; frame < 30; frame++) {
      await nextFrame()
      const element = root.current === null ? null : nodeElement(root.current, id)
      if (element !== null && element.getBoundingClientRect().width > 0) return element
    }
    return null
  }, [])

  const transition = useCallback(
    async (from: string | null, to: string | null): Promise<void> => {
      const container = root.current
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      const before = flow.getViewport()
      if (from === null) mapView.current = before
      const kind = from === null ? 'enter' : to === null ? 'leave' : 'through'
      const targetId = to ?? from ?? ''
      const sourceId = kind === 'enter' ? (to ?? '') : kind === 'through' ? `${STUB}${to ?? ''}` : (from ?? '')
      const sourceElement = container === null ? null : nodeElement(container, sourceId)
      const sourceRect = sceneRef.current.rects.get(sourceId)
      const box = { width: container?.clientWidth ?? 800, height: container?.clientHeight ?? 600 }
      // Sans animation (réduites, ou rien à animer) : la scène change, cadrée.
      if (container === null || sourceElement === null || sourceRect === undefined || reduce) {
        setScene(to)
        await rendered(targetId)
        const target = sceneRef.current.rects.get(targetId)
        if (to === null) void flow.setViewport(mapView.current ?? before)
        else if (target !== undefined) void flow.setViewport(fitFrame(target, box))
        return
      }
      // 1. Ce qu'on quitte : sa boîte et son titre à l'écran, puis une copie figée de la scène.
      const from0 = rectIn(container, sourceElement)
      const sourceTitle = sourceElement.querySelector('.box-title, .stub-name')
      const title0 =
        sourceTitle === null
          ? { x: from0.x + 8, y: from0.y + 4, size: 12 * before.zoom }
          : {
              ...rectIn(container, sourceTitle),
              size: parseFloat(getComputedStyle(sourceTitle).fontSize) * before.zoom
            }
      const viewport = container.querySelector('.react-flow__viewport')
      const flowRoot = container.querySelector('.react-flow')
      const ghostRoot = document.createElement('div')
      ghostRoot.className = `${flowRoot?.className ?? 'react-flow'} scene-ghost`
      // Une image, pas une scène : ni lue par les lecteurs d'écran, ni atteinte au clavier.
      ghostRoot.setAttribute('aria-hidden', 'true')
      ghostRoot.inert = true
      const ghostView = (viewport?.cloneNode(true) ?? document.createElement('div')) as HTMLElement
      ghostRoot.appendChild(ghostView)
      container.insertBefore(ghostRoot, container.firstChild)
      const ghostTarget = ghostView.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(sourceId)}"]`)
      ghostTarget
        ?.querySelectorAll<HTMLElement>('.box-title, .stub-name')
        .forEach((el) => (el.style.visibility = 'hidden'))
      const ghostOthers = [
        ...ghostView.querySelectorAll<HTMLElement>('.react-flow__node'),
        ...ghostView.querySelectorAll<HTMLElement>('.react-flow__edges')
      ].filter((el) => el !== ghostTarget)

      // 2. La nouvelle scène, invisible tant qu'elle n'est pas cadrée.
      container.classList.add('animating')
      container.style.setProperty('--scene-files', '0')
      setScene(to)
      const targetElement = await rendered(targetId)
      const target = sceneRef.current.rects.get(targetId)
      if (targetElement === null || target === undefined) {
        ghostRoot.remove()
        container.classList.remove('animating')
        container.style.removeProperty('--scene-files')
        return
      }
      targetElement.style.opacity = '0'
      const finalView = to === null ? (mapView.current ?? before) : fitFrame(target, box)
      const to1 = onScreen(target, finalView)
      // Le titre d'arrivée, mesuré sur la scène telle qu'elle est (en coordonnées de la carte), puis porté à la vue finale.
      const now = flow.getViewport()
      const targetTitle = targetElement.querySelector<HTMLElement>('.box-title')
      const nodeNow = rectIn(container, targetElement)
      const titleNow = targetTitle === null ? null : rectIn(container, targetTitle)
      const title1 =
        titleNow === null || targetTitle === null
          ? { x: to1.x + 17, y: to1.y + 30, size: 17 }
          : {
              x: to1.x + ((titleNow.x - nodeNow.x) / now.zoom) * finalView.zoom,
              y: to1.y + ((titleNow.y - nodeNow.y) / now.zoom) * finalView.zoom,
              size: parseFloat(getComputedStyle(targetTitle).fontSize) * finalView.zoom
            }
      if (targetTitle !== null) targetTitle.style.visibility = 'hidden'
      const label = document.createElement('span')
      label.className = 'scene-title'
      label.textContent = modulesByKey.get(targetId)?.title ?? ''
      container.appendChild(label)

      // 3. Un seul mouvement : les deux scènes cadrent leur nœud dans le même rectangle, image par image.
      const relayWindow: readonly [number, number] = kind === 'leave' ? [0.25, 0.85] : [0.15, 0.75]
      const othersWindow: readonly [number, number] = kind === 'leave' ? [0.3, 0.9] : [0.2, 0.7]
      const ghostWindow: readonly [number, number] = kind === 'leave' ? [0, 0.45] : [0, 0.6]
      const step = (t: number): void => {
        const e = ease(t)
        const r = lerpRect(from0, to1, e)
        ghostView.style.transform = transformOf(viewportOnto(sourceRect, r))
        void flow.setViewport(viewportOnto(target, r))
        const relay = fadeIn(t, relayWindow[0], relayWindow[1])
        targetElement.style.opacity = String(relay)
        container.style.setProperty('--scene-files', String(fadeIn(t, othersWindow[0], othersWindow[1])))
        if (ghostTarget !== null) ghostTarget.style.opacity = String(1 - relay)
        const fadeOut = String(1 - fadeIn(t, ghostWindow[0], ghostWindow[1]))
        for (const el of ghostOthers) el.style.opacity = fadeOut
        label.style.left = `${lerp(title0.x, title1.x, e)}px`
        label.style.top = `${lerp(title0.y, title1.y, e)}px`
        label.style.fontSize = `${lerp(title0.size, title1.size, e)}px`
      }
      step(0)
      await new Promise<void>((done) => {
        const start = performance.now()
        const tick = (now: number): void => {
          const t = Math.min(1, (now - start) / MORPH_MS)
          step(t)
          if (t < 1) requestAnimationFrame(tick)
          else done()
        }
        requestAnimationFrame(tick)
      })

      // 4. Fin : la vraie scène seule, à sa vue finale.
      ghostRoot.remove()
      label.remove()
      targetElement.style.opacity = ''
      if (targetTitle !== null) targetTitle.style.visibility = ''
      container.classList.remove('animating')
      container.style.removeProperty('--scene-files')
      void flow.setViewport(finalView)
    },
    [flow, modulesByKey, rendered]
  )

  useEffect(() => {
    if (running.current || focus === scene) return
    running.current = true
    const go = async (): Promise<void> => {
      let current = scene
      // Une demande arrivée pendant une transition est jouée ensuite.
      while (focusRef.current !== current) {
        const next = focusRef.current
        await transition(current, next)
        current = next
      }
      running.current = false
    }
    void go()
  }, [focus, scene, transition])

  // Échap ressort (sauf en écrivant dans un champ).
  useEffect(() => {
    if (focus === null) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (event.target instanceof Element && event.target.closest('input, textarea, select') !== null) return
      onLeave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, onLeave])

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const describe = (node: BoxNode): string | null => {
    if (node.type === 'file') {
      const file = node.data.file
      return `${file.path}${file.role === null ? '' : ` : ${file.role}`}`
    }
    if (node.type === 'stub') return `Appels avec ${node.data.module.title} : clic pour y entrer.`
    const module: MapModuleView = node.data.module
    return `${module.title} · ${LAYER_LABELS[module.layer].text}${module.role === null ? '' : ` : ${module.role}`}`
  }

  return (
    <div
      ref={root}
      className="box-scene h-full w-full"
      onDoubleClick={(event) => {
        if (scene !== null && (event.target as HTMLElement).classList.contains('react-flow__pane')) onLeave()
      }}
    >
      <ReactFlow<BoxNode>
        nodes={nodes}
        edges={built.edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={(changes: NodeChange<BoxNode>[]) =>
          setNodes((current) => applyNodeChanges<BoxNode>(changes, current))
        }
        onNodeClick={(_event, node) => {
          if (node.type === 'file') onFile(node.data.file)
          else if (node.type === 'stub') onEnter(node.data.module.key)
          else if (node.type === 'frame') onSelect(node.id)
          else {
            if (clickTimer.current !== null) clearTimeout(clickTimer.current)
            clickTimer.current = setTimeout(() => onModule(node.id), CLICK_DELAY_MS)
          }
        }}
        onNodeDoubleClick={(_event, node) => {
          if (node.type !== 'module') return
          if (clickTimer.current !== null) clearTimeout(clickTimer.current)
          onEnter(node.id)
        }}
        onNodeMouseEnter={(_event, node) => onCaption(describe(node))}
        onNodeMouseLeave={() => onCaption(null)}
        onEdgeMouseEnter={(_event, edge) => onCaption((edge.data as { text?: string } | undefined)?.text ?? null)}
        onEdgeMouseLeave={() => onCaption(null)}
        onPaneClick={() => {
          if (scene === null) onCloseAll()
        }}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        zoomOnDoubleClick={false}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        minZoom={0.05}
        maxZoom={3}
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
