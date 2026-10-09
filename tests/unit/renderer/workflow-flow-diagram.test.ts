import { describe, expect, it } from 'vitest'
import type { WorkflowFileSummaryView } from '@shared/ipc/workflow'
import {
  BOX_HEIGHT,
  flowLayout,
  flowMermaid,
  LABEL_HEIGHT
} from '../../../src/renderer/src/canvas/workflow/flowDiagram'

const summary = (
  flow: WorkflowFileSummaryView['flow'],
  parts: readonly string[] = ['Carte', 'lire', 'ranger']
): WorkflowFileSummaryView => ({
  role: 'r',
  receives: 'Le nœud "choisi" | ses fichiers',
  produces: 'Une carte',
  parts: parts.map((name, index) => ({ name, why: `pour ${name}`, startLine: index + 1, endLine: index + 1 })),
  flow,
  engine: 'claude',
  model: 'm'
})

describe('petit schéma d’une explication (spec 023 D15)', () => {
  it('should_put_the_input_on_top_the_output_at_the_bottom_and_parts_at_their_longest_path', () => {
    const { boxes, arrows } = flowLayout(
      summary([
        { from: 'in', to: 'Carte', label: 'ouvre' },
        { from: 'Carte', to: 'lire', label: 'lit' },
        { from: 'Carte', to: 'ranger', label: 'range' },
        { from: 'lire', to: 'ranger', label: 'passe' },
        { from: 'ranger', to: 'out', label: 'affiche' }
      ])
    )
    const y = Object.fromEntries(boxes.map((box) => [box.id, box.y]))
    expect(y.in).toBeLessThan(y.Carte as number)
    expect(y.Carte).toBeLessThan(y.lire as number)
    // ranger : plus long chemin (in → Carte → lire → ranger), sous lire.
    expect(y.lire).toBeLessThan(y.ranger as number)
    expect(y.ranger).toBeLessThan(y.out as number)
    expect(boxes.find((box) => box.id === 'ranger')).toMatchObject({ kind: 'part', number: 3, label: '3. ranger' })
    expect(boxes.find((box) => box.id === 'in')).toMatchObject({ kind: 'in', number: null, label: 'Reçoit' })
    expect(arrows).toHaveLength(5)
  })

  it('should_survive_a_cycle_and_draw_the_going_up_arrow_on_the_side', () => {
    const { boxes, arrows } = flowLayout(
      summary([
        { from: 'in', to: 'Carte', label: 'ouvre' },
        { from: 'Carte', to: 'lire', label: 'lit' },
        { from: 'lire', to: 'Carte', label: 'rappelle' }
      ])
    )
    expect(boxes.map((box) => box.id).sort()).toEqual(['Carte', 'in', 'lire'])
    const back = arrows.find((arrow) => arrow.label === 'rappelle')
    expect(back?.path.startsWith('M ')).toBe(true)
    expect(back?.labelX).toBeGreaterThan(boxes.find((box) => box.id === 'lire')?.x ?? 0)
  })

  it('should_breathe_with_starts_on_the_first_row_and_no_label_touching_a_box_or_another_label', () => {
    // Le cas de la capture de mentalyas : quatre départs et l'entrée convergent sur renderCard.
    const parts = ['renderCard', 'Current', 'item', 'block', 'openFile', 'reader']
    const { boxes, arrows } = flowLayout(
      summary(
        [
          { from: 'in', to: 'renderCard', label: 'configure' },
          { from: 'item', to: 'renderCard', label: 'fournit le nœud à' },
          { from: 'block', to: 'renderCard', label: 'simule le contenu' },
          { from: 'openFile', to: 'renderCard', label: 'ouvre le fichier dans la carte de détail' },
          { from: 'renderCard', to: 'Current', label: 'monte' },
          { from: 'reader', to: 'Current', label: 'contrôle' },
          { from: 'Current', to: 'out', label: 'affiche' }
        ],
        parts
      )
    )
    const y = Object.fromEntries(boxes.map((box) => [box.id, box.y]))
    for (const id of ['item', 'block', 'openFile', 'reader']) expect(y[id], id).toBe(y.in)
    const rects = [
      ...boxes.map((box) => ({ x: box.x, y: box.y, w: box.width, h: BOX_HEIGHT })),
      ...arrows.map((arrow) => ({
        x: arrow.labelX - arrow.labelWidth / 2,
        y: arrow.labelY - LABEL_HEIGHT / 2,
        w: arrow.labelWidth,
        h: LABEL_HEIGHT
      }))
    ]
    const touching = rects.flatMap((a, i) =>
      rects.slice(i + 1).filter((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
    )
    expect(touching).toEqual([])
    const long = arrows.find((arrow) => arrow.label.startsWith('ouvre le fichier'))
    expect(long?.text).toBe('ouvre le fichier dans l…')
  })

  it('should_draw_nothing_without_links', () => {
    expect(flowLayout(summary([]))).toEqual({ boxes: [], arrows: [], width: 0, height: 0 })
  })

  it('should_write_escaped_mermaid_with_generated_ids', () => {
    const text = flowMermaid(
      summary([
        { from: 'in', to: 'Carte', label: 'ouvre | lit' },
        { from: 'Carte', to: 'out', label: 'affiche' }
      ])
    )
    expect(text.split('\n')).toEqual([
      'flowchart TD',
      '  in(["Reçoit : Le nœud #quot;choisi#quot; #124; ses fichiers"])',
      '  p1["1. Carte"]',
      '  out(["Produit : Une carte"])',
      '  in -->|ouvre #124; lit| p1',
      '  p1 -->|affiche| out'
    ])
  })
})
