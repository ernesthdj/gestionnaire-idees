import { describe, expect, it } from 'vitest'
import { layoutTree, overlaps, SKILL_NODE } from '../../../src/renderer/src/skills/skillTree'

const groups = (count: number, size: number) =>
  Array.from({ length: count }, (_, g) => ({
    id: `g${g}`,
    label: `Groupe ${g}`,
    items: Array.from({ length: size }, (_, i) => `g${g}-s${i}`)
  }))

describe('disposition de l’arbre de skills (spec 020 T008)', () => {
  it('should_place_every_skill_without_overlap_whatever_the_number_of_branches', () => {
    for (const [count, size] of [
      [1, 10],
      [3, 25],
      [7, 20],
      [10, 15]
    ] as const) {
      const points = [...layoutTree(groups(count, size)).items.values()]
      expect(points).toHaveLength(count * size)
      for (let i = 0; i < points.length; i += 1)
        for (let j = i + 1; j < points.length; j += 1)
          expect(overlaps(points[i] as never, points[j] as never), `${count}×${size} : ${i} / ${j}`).toBe(false)
    }
  })

  it('should_keep_skills_away_from_the_trunk_and_be_deterministic', () => {
    const first = layoutTree(groups(3, 7))
    expect(layoutTree(groups(3, 7))).toEqual(first)
    for (const point of first.items.values()) expect(Math.hypot(point.x, point.y)).toBeGreaterThan(SKILL_NODE.width)
  })
})
