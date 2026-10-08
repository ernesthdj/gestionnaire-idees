import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  activate,
  closeCard,
  closeUnpinned,
  EMPTY_CARDS,
  moveCard,
  openCard,
  setSide,
  togglePin,
  toggleSheet
} from '../../../src/renderer/src/canvas/cards/cardsStore'
import { dampStep, wheelFactor, zoomAround, ZOOM_BOUNDS } from '../../../src/renderer/src/canvas/useSmoothZoom'
import { GLIDE_MS, useGlide } from '../../../src/renderer/src/canvas/useGlide'
import { LivingNode } from '../../../src/renderer/src/canvas/living/LivingNode'
import type { NodeVisual } from '../../../src/renderer/src/canvas/living/nodeVisual'
import { expectNoAxeViolations } from '../../support/axe'

describe('cardsStore', () => {
  it('should_open_several_cards_without_duplicates_when_nodes_are_clicked', () => {
    let state = openCard(EMPTY_CARDS, 'a')
    state = openCard(state, 'b')
    state = openCard(state, 'a')
    expect(state.cards.map((card) => card.id)).toEqual(['a', 'b'])
    expect(state.activeId).toBe('a')
  })

  it('should_bring_the_touched_card_to_front_when_activated', () => {
    let state = openCard(openCard(EMPTY_CARDS, 'a'), 'b')
    state = activate(state, 'a')
    const z = (id: string): number => state.cards.find((card) => card.id === id)?.z ?? 0
    expect(z('a')).toBeGreaterThan(z('b'))
    expect(activate(state, 'missing')).toBe(state)
  })

  it('should_activate_the_highest_remaining_card_when_the_active_one_closes', () => {
    let state = openCard(openCard(openCard(EMPTY_CARDS, 'a'), 'b'), 'c')
    state = activate(state, 'a')
    state = closeCard(state, 'a')
    expect(state.activeId).toBe('c')
    expect(closeCard(closeCard(state, 'b'), 'c')).toEqual({ cards: [], activeId: null })
  })

  it('should_replace_the_chat_by_the_reader_when_a_file_opens', () => {
    let state = openCard(EMPTY_CARDS, 'a', { side: 'chat' })
    expect(state.cards[0]?.side).toBe('chat')
    state = setSide(state, 'a', 'reader', { source: 'deliverable', path: 'src/x.ts', tab: 'diff' })
    expect(state.cards[0]).toMatchObject({ side: 'reader', reader: { path: 'src/x.ts' } })
    state = setSide(state, 'a', 'chat')
    expect(state.cards[0]).toMatchObject({ side: 'chat', reader: null })
  })

  it('should_keep_the_sheet_and_offset_independent_when_changed', () => {
    let state = openCard(EMPTY_CARDS, 'a', { side: 'chat' })
    state = toggleSheet(moveCard(state, 'a', { x: 40, y: -12 }), 'a')
    expect(state.cards[0]).toMatchObject({ sheet: true, side: 'chat', offset: { x: 40, y: -12 } })
  })
})

describe('ancrage des cartes (D28)', () => {
  it('should_close_unpinned_cards_but_keep_pinned_ones_and_the_one_being_opened_when_clicking_outside', () => {
    let state = openCard(openCard(openCard(EMPTY_CARDS, 'a'), 'b'), 'c')
    state = togglePin(state, 'b')
    state = closeUnpinned(state, 'c')
    expect(state.cards.map((card) => card.id)).toEqual(['b', 'c'])
    expect(closeUnpinned(state).cards.map((card) => card.id)).toEqual(['b'])
    expect(togglePin(state, 'b').cards.find((card) => card.id === 'b')?.pinned).toBe(false)
  })
})

describe('smooth zoom', () => {
  it('should_keep_the_point_under_the_pointer_fixed_when_zooming', () => {
    const before = { x: 30, y: -20, zoom: 1 }
    const after = zoomAround(before, 1.5, 200, 120)
    const world = (v: typeof before): { x: number; y: number } => ({ x: (200 - v.x) / v.zoom, y: (120 - v.y) / v.zoom })
    expect(world(after).x).toBeCloseTo(world(before).x)
    expect(world(after).y).toBeCloseTo(world(before).y)
  })

  it('should_stay_within_bounds_when_zooming_far', () => {
    expect(zoomAround({ x: 0, y: 0, zoom: 1 }, 100, 0, 0).zoom).toBe(ZOOM_BOUNDS.max)
    expect(zoomAround({ x: 0, y: 0, zoom: 1 }, 0.001, 0, 0).zoom).toBe(ZOOM_BOUNDS.min)
    expect(wheelFactor(-100)).toBeGreaterThan(1)
    expect(wheelFactor(100)).toBeLessThan(1)
  })

  it('should_converge_then_stop_when_damping_toward_the_target', () => {
    const target = { x: 100, y: 50, zoom: 1.5 }
    let current: { x: number; y: number; zoom: number } | null = { x: 0, y: 0, zoom: 1 }
    let steps = 0
    while (current !== null && steps < 500) {
      const next = dampStep(current, target)
      if (next === null) break
      current = next
      steps++
    }
    expect(steps).toBeLessThan(120)
    expect(current?.x).toBeCloseTo(100, 0)
    expect(dampStep(target, target)).toBeNull()
  })
})

describe('useGlide', () => {
  it('should_glide_for_a_while_when_the_layout_changes', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ sig }) => useGlide(sig, false), { initialProps: { sig: 'a' } })
    expect(result.current).toBe('off')
    rerender({ sig: 'b' })
    expect(result.current).toBe('on')
    act(() => vi.advanceTimersByTime(GLIDE_MS))
    expect(result.current).toBe('off')
    vi.useRealTimers()
  })

  it('should_never_glide_when_motion_is_reduced', () => {
    const { result, rerender } = renderHook(({ sig }) => useGlide(sig, true), { initialProps: { sig: 'a' } })
    rerender({ sig: 'b' })
    expect(result.current).toBe('off')
  })
})

describe('LivingNode', () => {
  const sat: NodeVisual = { depth: 2, branch: 3, size: 44, icon: 'step', status: 'doing', orb: false }

  it('should_show_title_status_and_fold_when_a_sub_node_has_children', async () => {
    const onToggle = vi.fn()
    const { container } = render(
      <LivingNode
        id="s1"
        title="Rédiger les textes"
        visual={sat}
        rank="②"
        hasFiles
        fold={{ collapsed: true, count: 3, onToggle }}
      />
    )
    expect(screen.getByText('Rédiger les textes')).toBeTruthy()
    expect(screen.getByText('En cours')).toBeTruthy()
    const fold = screen.getByRole('button', { name: 'Déplier « Rédiger les textes » (3 sous-nœuds)' })
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(fold)
    expect(onToggle).toHaveBeenCalledOnce()
    await expectNoAxeViolations(container)
  })

  it('should_draw_an_orb_with_its_state_when_the_node_is_a_root', async () => {
    const { container } = render(
      <LivingNode
        id="g"
        title="Planifier le portfolio"
        visual={{ depth: 0, branch: null, size: 0, icon: 'idea', orb: true }}
        orb={{ size: 92, state: 'hatched' }}
      />
    )
    const face = container.querySelector('.living-orb')
    expect(face?.getAttribute('data-state')).toBe('hatched')
    expect(container.querySelector('.living-ping')).not.toBeNull()
    expect(container.querySelector('.living-fold')).toBeNull()
    await expectNoAxeViolations(container)
  })

  it('should_vary_its_float_rhythm_when_ids_differ', () => {
    const { container } = render(
      <>
        <LivingNode id="a" title="A" visual={sat} />
        <LivingNode id="b" title="B" visual={sat} />
      </>
    )
    const [a, b] = [...container.querySelectorAll<HTMLElement>('.living')]
    expect(a?.style.getPropertyValue('--float-dur')).not.toBe(b?.style.getPropertyValue('--float-dur'))
  })
})
