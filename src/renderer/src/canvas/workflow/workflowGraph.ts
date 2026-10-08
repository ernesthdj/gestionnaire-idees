import { layoutUnder, type AlternateOptions, type Point, type Size } from '../layout/alternateLayout'
import { nodeVisuals, type NodeVisual, type TreeNodeInput } from '../living/nodeVisual'
import type { WorkflowItem, WorkflowTree } from './workflowTree'

/**
 * Disposition de la vue Workflow (spec 023 D8) : la disposition en sens alterné de la spec 022 sous le genesis (branches
 * en colonne, specs en ligne, user stories en colonne, tâches en ligne), nœuds vivants colorés par branche et de plus
 * en plus petits. Les nœuds repliés ne sont pas placés : la carte les fait glisser dans leur parent. Pure.
 */

/** Case d'un nœud selon sa profondeur (cercle + titre dessous) : 1 branche, 2 spec, 3 user story, 4 tâche. */
export const WORKFLOW_CELLS: readonly Size[] = [
  { width: 200, height: 124 },
  { width: 190, height: 118 },
  { width: 176, height: 110 },
  { width: 164, height: 104 }
]
const SPACING = { across: 16, down: 8, branch: 24 } as const
/** Air entre le bord de l'orbe du genesis et la première branche. */
const BELOW_GAP = 72

export interface PlacedWorkflowItem {
  readonly item: WorkflowItem
  readonly depth: number
  readonly visual: NodeVisual
  /** Centre. */
  readonly x: number
  readonly y: number
}

export interface WorkflowEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly branch: number | null
}

export interface WorkflowGraph {
  readonly placed: readonly PlacedWorkflowItem[]
  readonly edges: readonly WorkflowEdge[]
}

const FALLBACK: NodeVisual = { depth: 1, branch: null, size: 44, icon: 'task', orb: false }

export function workflowGraph(
  tree: WorkflowTree,
  genesisId: string,
  center: Point,
  /** Rayon de l'orbe du genesis. */
  rootRadius: number,
  /** « Réorganiser » (spec 022 D22) : les branches partent en ligne à droite. */
  transposed = false
): WorkflowGraph {
  const visible = tree.visible
  const kids = new Map<string, WorkflowItem[]>()
  for (const item of visible) kids.set(item.parentKey, [...(kids.get(item.parentKey) ?? []), item])
  const visuals = nodeVisuals([
    { id: genesisId, parentId: null, icon: 'project' },
    ...visible.map((item): TreeNodeInput => ({
      id: item.key,
      parentId: item.parentKey,
      icon: item.icon,
      ...(item.status === undefined ? {} : { status: item.status })
    }))
  ])
  const byKey = new Map(visible.map((item) => [item.key, item] as const))
  const depthOf = new Map<string, number>()
  const placed: PlacedWorkflowItem[] = []
  const edges: WorkflowEdge[] = []
  const options: AlternateOptions = {
    childrenOf: (id) => (byKey.get(id)?.collapsed === true ? [] : (kids.get(id) ?? []).map((item) => item.key)),
    sizeOf: (id) => {
      const depth = depthOf.get(id) ?? 1
      return WORKFLOW_CELLS[Math.min(depth, WORKFLOW_CELLS.length) - 1] as Size
    },
    across: SPACING.across,
    down: SPACING.down,
    transposed,
    visit: (id, depth, at, children) => {
      const item = byKey.get(id)
      if (item === undefined) return
      placed.push({ item, depth, visual: visuals.get(id) ?? FALLBACK, x: at.x, y: at.y })
      for (const child of children) {
        depthOf.set(child, depth + 1)
        edges.push({ id: `wf-edge-${child}`, source: id, target: child, branch: visuals.get(child)?.branch ?? null })
      }
    }
  }
  for (const top of kids.get(genesisId) ?? []) {
    depthOf.set(top.key, 1)
    edges.push({
      id: `wf-edge-${top.key}`,
      source: genesisId,
      target: top.key,
      branch: visuals.get(top.key)?.branch ?? null
    })
  }
  // Le genesis n'est pas un nœud Workflow (jamais replié ici) : ses enfants sont les branches.
  layoutUnder(genesisId, center, rootRadius + BELOW_GAP, SPACING.branch, options)
  return { placed, edges }
}
