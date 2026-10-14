import {
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type NodeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useContext, useEffect, useMemo, useState } from 'react'
import { colorSchemeOf } from '@shared/ipc/app'
import type { ExplorerMapView, LinkProvenance, MapCallSentence, MapFileView } from '@shared/ipc/reprise'
import { weakestProvenance } from '@shared/ipc/reprise'
import { useEffectiveSettings } from '../../app/useAppSettings'
import { MarksKindContext, ReplayMarksContext } from '../ExplorerNodes'
import { LAYER_LABELS, PROVENANCE_LABELS, sentenceText } from '../labels'
import { boxLayout, isBig, type ShownBoxes } from './boxLayout'
import { FileBox, ModuleBox, type FileBoxNode, type ModuleBoxNode } from './BoxNodes'

const NODE_TYPES = { module: ModuleBox, file: FileBox }
const ARIA_LABELS = {
  'node.a11yDescription.default': 'Entrée pour ouvrir ou fermer le module, ou ouvrir le code du fichier.',
  'node.a11yDescription.keyboardDisabled': 'Entrée pour ouvrir ou fermer le module, ou ouvrir le code du fichier.',
  'edge.a11yDescription.default': 'Appels entre deux éléments.',
  'controls.ariaLabel': 'Zoom',
  'controls.zoomIn.ariaLabel': 'Zoomer',
  'controls.zoomOut.ariaLabel': 'Dézoomer',
  'controls.fitView.ariaLabel': 'Tout afficher',
  'controls.interactive.ariaLabel': 'Verrouiller la carte'
}

type BoxNode = ModuleBoxNode | FileBoxNode

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

/**
 * Traits de la carte (spec 031 D3, D7) : un appel arrive sur le fichier exact quand son module est ouvert en boîtes,
 * sinon sur le module ; les appels entre fichiers d'un module ouvert sont tracés (couleur d'accent).
 */
function linksOf(map: ExplorerMapView, shown: ShownBoxes, open: ReadonlySet<string>): Link[] {
  const moduleOf = new Map<string, string>()
  const inBoxes = new Set<string>()
  for (const module of shown.modules) {
    const files = shown.filesOf.get(module.key) ?? []
    for (const file of files) moduleOf.set(file.key, module.key)
    if (open.has(module.key) && !isBig(files)) for (const file of files) inBoxes.add(file.key)
  }
  const end = (fileKey: string): string | null => (inBoxes.has(fileKey) ? fileKey : (moduleOf.get(fileKey) ?? null))
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

/**
 * Carte d'ensemble en boîtes (spec 031 lot 2) : les modules de gauche à droite dans le sens des appels ; un clic ouvre
 * une boîte sur place (ses fichiers en boîtes, ou en liste filtrable au-delà de 6) ; un clic dans le vide les referme ;
 * le survol d'un trait dit l'appel en mots.
 */
export function BoxMap({
  map,
  shown,
  open,
  selected,
  onModule,
  onFile,
  onCloseAll,
  onCaption
}: {
  readonly map: ExplorerMapView
  readonly shown: ShownBoxes
  readonly open: ReadonlySet<string>
  readonly selected: string | null
  readonly onModule: (key: string) => void
  readonly onFile: (file: MapFileView) => void
  readonly onCloseAll: () => void
  /** Phrase de l'élément ou du trait survolé ; `null` : rien. */
  readonly onCaption: (text: string | null) => void
}): React.JSX.Element {
  const settings = useEffectiveSettings()
  const byKey = useContext(ReplayMarksContext)
  const markKind = useContext(MarksKindContext)
  const built = useMemo(() => {
    const layout = boxLayout(shown, open)
    const nodes: BoxNode[] = []
    for (const module of shown.modules) {
      const rect = layout.modules.get(module.key)
      if (rect === undefined) continue
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
    const links = linksOf(map, shown, open)
    const edges: Edge[] = links.map((link) => ({
      id: `${link.from}→${link.to}`,
      source: link.from,
      target: link.to,
      markerEnd: { type: MarkerType.ArrowClosed },
      ariaLabel: link.sentences.map(sentenceText).join(' ; ') || `${link.count} appel${link.count > 1 ? 's' : ''}`,
      data: { text: link.sentences.map(sentenceText).join(' · ') },
      style: {
        strokeWidth: 1.4 + Math.min(4, Math.log2(link.count + 1)),
        strokeDasharray: PROVENANCE_LABELS[link.provenance].dash,
        stroke:
          link.provenance === 'uncertain' ? 'var(--color-action)' : link.internal ? 'var(--color-accent)' : undefined
      }
    }))
    return { nodes, edges }
  }, [map, shown, open, selected, byKey, markKind])

  // Les boîtes restent déplaçables (spec 031 lot 5 : positions gardées) ; une nouvelle mise en page les replace.
  const [nodes, setNodes] = useState<BoxNode[]>(built.nodes)
  useEffect(() => setNodes(built.nodes), [built.nodes])

  return (
    <ReactFlow<BoxNode>
      nodes={nodes}
      edges={built.edges}
      nodeTypes={NODE_TYPES}
      onNodesChange={(changes: NodeChange<BoxNode>[]) =>
        setNodes((current) => applyNodeChanges<BoxNode>(changes, current))
      }
      onNodeClick={(_event, node) => {
        if (node.type === 'file') onFile((node as FileBoxNode).data.file)
        else onModule(node.id)
      }}
      onNodeMouseEnter={(_event, node) => {
        if (node.type === 'file') {
          const file = (node as FileBoxNode).data.file
          onCaption(`${file.path}${file.role === null ? '' : ` : ${file.role}`}`)
        } else {
          const module = (node as ModuleBoxNode).data.module
          onCaption(
            `${module.title} · ${LAYER_LABELS[module.layer].text}${module.role === null ? '' : ` : ${module.role}`}`
          )
        }
      }}
      onNodeMouseLeave={() => onCaption(null)}
      onEdgeMouseEnter={(_event, edge) => onCaption((edge.data as { text?: string } | undefined)?.text ?? null)}
      onEdgeMouseLeave={() => onCaption(null)}
      onPaneClick={onCloseAll}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
      zoomOnDoubleClick={false}
      nodesConnectable={false}
      edgesFocusable={false}
      deleteKeyCode={null}
      minZoom={0.3}
      maxZoom={2.5}
      ariaLabelConfig={ARIA_LABELS}
      colorMode={colorSchemeOf(settings.theme)}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
